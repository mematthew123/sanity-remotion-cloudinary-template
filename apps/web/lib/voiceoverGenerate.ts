import {createClient, type SanityClient} from '@sanity/client'
import {
  chunkPortableTextForNarration,
  type Chunk,
  type ResolvedChunk,
  type WordTiming,
} from '@template/video-core/registry'
import {generateSpeechMp3, estimateSpeechCostUsd, forceAlignWords} from './elevenlabs'
import {
  computeChunkId,
  configureCloudinaryFromEnv,
  existingVoiceoverUrl,
  uploadVoiceoverMp3,
  voiceoverPublicId,
} from './voiceoverStore'

// Shared TTS generation loop used by both the CLI and the
// /api/voiceover/generate route so they don't drift. Pure server-side.

export type GenerateVoiceoverArgs = {
  postId: string
  voiceId: string
  modelId?: string
  /** Skip ElevenLabs + Cloudinary; only report what *would* happen. */
  dryRun?: boolean
  /** Per-chunk progress callback, fired after each chunk resolves. */
  onProgress?: (event: {
    index: number
    total: number
    chunk: ResolvedChunk
    cached: boolean
  }) => void | Promise<void>
  /** Injectable Sanity client (routes pass one configured for their env). */
  sanityClient?: SanityClient
}

export type GenerateVoiceoverResult = {
  chunkCount: number
  totalChars: number
  estimatedFreshCostUsd: number
  /** On dryRun, what *would* have been written; otherwise the patched value. */
  chunks: ResolvedChunk[]
  cacheHits: number
  generated: number
  totalSeconds: number
}

function getSanityClientFromEnv(): SanityClient {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !dataset || !token) {
    throw new Error(
      'Sanity not configured (NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_WRITE_TOKEN)',
    )
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-12-27',
    useCdn: false,
    perspective: 'drafts',
  })
}

export async function generateVoiceoverForPost(
  args: GenerateVoiceoverArgs,
): Promise<GenerateVoiceoverResult> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('CLOUDINARY_CLOUD_NAME not set')
  }
  configureCloudinaryFromEnv()

  const sanity = args.sanityClient ?? getSanityClientFromEnv()
  const modelId = args.modelId ?? 'eleven_multilingual_v2'

  const baseId = args.postId.replace(/^drafts\./, '')
  const draftId = `drafts.${baseId}`

  const post = await sanity.fetch<{
    _id: string
    _rev: string
    body: unknown[] | null
    voiceoverChunks?: Array<{id?: string; words?: WordTiming[]}> | null
  } | null>(
    `*[_type == "post" && _id in [$draftId, $baseId]] | order(_updatedAt desc)[0]{
      _id, _rev, body, "voiceoverChunks": voiceoverChunks[]{id, words}
    }`,
    {draftId, baseId},
  )
  if (!post) throw new Error(`Post ${args.postId} not found (looked at ${draftId} and ${baseId})`)
  if (!post.body) throw new Error(`Post ${args.postId} has no body`)

  // Reuse word alignments stored for unchanged chunks (keyed by chunk id) so
  // re-runs skip forced alignment; new/changed chunks get aligned below.
  const existingWordsById = new Map<string, WordTiming[]>()
  for (const c of post.voiceoverChunks ?? []) {
    if (c?.id && Array.isArray(c.words) && c.words.length > 0) existingWordsById.set(c.id, c.words)
  }

  // Resolve word timings: reuse if stored, else run forced alignment. Failure
  // is non-fatal — captions fall back to paragraph-level cues.
  const resolveWords = async (
    id: string,
    text: string,
    getAudio: () => Promise<Buffer>,
  ): Promise<WordTiming[] | undefined> => {
    const existing = existingWordsById.get(id)
    if (existing) return existing
    try {
      const words = await forceAlignWords(await getAudio(), text)
      return words.length > 0 ? words : undefined
    } catch (err) {
      console.warn(
        `[voiceover] forced alignment failed for chunk ${id}:`,
        err instanceof Error ? err.message : err,
      )
      return undefined
    }
  }

  const chunks: Chunk[] = chunkPortableTextForNarration(post.body)
  if (chunks.length === 0) {
    throw new Error('Body chunked to zero non-empty paragraphs — nothing to narrate')
  }

  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0)
  const estimatedFreshCostUsd = estimateSpeechCostUsd(totalChars)

  if (args.dryRun) {
    return {
      chunkCount: chunks.length,
      totalChars,
      estimatedFreshCostUsd,
      chunks: [],
      cacheHits: 0,
      generated: 0,
      totalSeconds: 0,
    }
  }

  const resolved: ResolvedChunk[] = []
  let cacheHits = 0
  let generated = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = computeChunkId(chunk.text, args.voiceId, modelId)
    const publicId = voiceoverPublicId(baseId, id)

    const cached = await existingVoiceoverUrl(publicId)
    if (cached) {
      // Cached audio: re-fetch the MP3 only if alignment is still needed
      // (resolveWords short-circuits when words exist).
      const words = await resolveWords(id, chunk.text, async () =>
        Buffer.from(await (await fetch(cached.url)).arrayBuffer()),
      )
      const entry: ResolvedChunk = {
        id,
        text: chunk.text,
        audioUrl: cached.url,
        durationSeconds: cached.durationSeconds,
        ...(words ? {words} : {}),
      }
      resolved.push(entry)
      cacheHits += 1
      await args.onProgress?.({index: i, total: chunks.length, chunk: entry, cached: true})
      continue
    }

    const mp3 = await generateSpeechMp3({text: chunk.text, voiceId: args.voiceId, modelId})
    const uploaded = await uploadVoiceoverMp3(publicId, mp3)
    const words = await resolveWords(id, chunk.text, async () => mp3)
    const entry: ResolvedChunk = {
      id,
      text: chunk.text,
      audioUrl: uploaded.url,
      durationSeconds: uploaded.durationSeconds,
      ...(words ? {words} : {}),
    }
    resolved.push(entry)
    generated += 1
    await args.onProgress?.({index: i, total: chunks.length, chunk: entry, cached: false})
  }

  // Each array member needs a unique, stable `_key` or Studio errors ("Missing
  // keys"). `id` is a hash of (text, voiceId, modelId) — suffix the index so
  // identical paragraphs still get distinct keys.
  const voiceoverChunks = resolved.map((chunk, i) => ({
    _key: `${chunk.id}-${i}`,
    ...chunk,
    // Word members need stable `_key`s too; index is stable per chunk.
    ...(chunk.words
      ? {words: chunk.words.map((w, wi) => ({_key: `w${wi}`, text: w.text, start: w.start, end: w.end}))}
      : {}),
  }))

  await sanity.patch(post._id).set({voiceoverChunks}).commit()

  const totalSeconds = resolved.reduce((sum, c) => sum + c.durationSeconds, 0)

  return {
    chunkCount: chunks.length,
    totalChars,
    estimatedFreshCostUsd,
    chunks: resolved,
    cacheHits,
    generated,
    totalSeconds,
  }
}
