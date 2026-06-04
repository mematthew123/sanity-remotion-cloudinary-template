// generate-voiceover.ts — Phase 1 deliverable from PLAN-narrated-videos.md.
//
// Usage:
//   pnpm --filter @template/web generate-voiceover -- --post-id=<id> [--voice-id=<id>] [--model=<id>] [--dry-run]
//
// What it does:
//   1. Loads the post body from Sanity (drafts perspective — editors haven't
//      always published before iterating on narration).
//   2. Chunks the body at paragraph boundaries via chunkPortableTextForNarration.
//   3. For each chunk: computes a cache id, checks Cloudinary for an existing
//      MP3, generates+uploads if missing.
//   4. Patches `post.voiceoverChunks` with the resolved chunks (id, text, audioUrl).
//
// No Remotion involvement yet — that lands in Phase 2. This script's success
// criterion is: a JSON list of MP3 URLs sitting on the post, playable in any
// browser.

// Load env in the same precedence order Next.js uses for local dev:
// `.env.local` overrides `.env`. Plain `dotenv/config` would only load `.env`,
// so user-supplied secrets in `.env.local` (the gitignored file) would be
// invisible to this CLI.
import {config as loadEnv} from 'dotenv'
loadEnv({path: '.env'})
loadEnv({path: '.env.local', override: true})

import {createClient} from '@sanity/client'
import {chunkPortableTextForNarration, type ResolvedChunk} from '@template/video-core/registry'
import {generateSpeechMp3, estimateSpeechCostUsd} from '../lib/elevenlabs'
import {
  computeChunkId,
  configureCloudinaryFromEnv,
  existingVoiceoverUrl,
  uploadVoiceoverMp3,
  voiceoverPublicId,
} from '../lib/voiceoverStore'

type Args = {
  postId: string
  voiceId: string
  modelId: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`
    const hit = argv.find((a) => a.startsWith(prefix))
    return hit ? hit.slice(prefix.length) : undefined
  }
  const postId = get('post-id')
  if (!postId) {
    throw new Error('Missing --post-id=<sanity-doc-id>')
  }
  const voiceId = get('voice-id') ?? process.env.ELEVENLABS_VOICE_ID
  if (!voiceId) {
    throw new Error(
      'No voice id. Pass --voice-id=<id> or set ELEVENLABS_VOICE_ID in apps/web/.env.local',
    )
  }
  const modelId = get('model') ?? 'eleven_multilingual_v2'
  const dryRun = argv.includes('--dry-run')
  return {postId, voiceId, modelId, dryRun}
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !dataset || !token) {
    throw new Error(
      'Sanity not configured (NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_WRITE_TOKEN)',
    )
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('CLOUDINARY_CLOUD_NAME not set')
  }

  configureCloudinaryFromEnv()

  // `drafts` perspective + write client so we see in-progress posts editors
  // are iterating on. The patch later targets `drafts.<id>` explicitly to
  // avoid the perspective-rewrites-_id gotcha (same as the newsletter route).
  const sanity = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-12-27',
    useCdn: false,
    perspective: 'drafts',
  })

  const baseId = args.postId.replace(/^drafts\./, '')
  const draftId = `drafts.${baseId}`

  const post = await sanity.fetch<{_id: string; _rev: string; body: unknown[] | null} | null>(
    `*[_type == "post" && _id in [$draftId, $baseId]] | order(_updatedAt desc)[0]{_id, _rev, body}`,
    {draftId, baseId},
  )
  if (!post) throw new Error(`Post ${args.postId} not found (looked at ${draftId} and ${baseId})`)
  if (!post.body) throw new Error(`Post ${args.postId} has no body`)

  const chunks = chunkPortableTextForNarration(post.body)
  if (chunks.length === 0) {
    throw new Error('Body chunked to zero non-empty paragraphs — nothing to narrate')
  }

  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0)
  console.log(
    `${chunks.length} chunks · ${totalChars} chars · est. fresh cost $${estimateSpeechCostUsd(totalChars).toFixed(2)} (cached chunks free)`,
  )

  if (args.dryRun) {
    console.log('--dry-run, exiting before any API calls')
    process.exit(0)
  }

  const resolved: ResolvedChunk[] = []
  let cacheHits = 0
  let generated = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = computeChunkId(chunk.text, args.voiceId, args.modelId)
    const publicId = voiceoverPublicId(baseId, id)

    const cached = await existingVoiceoverUrl(publicId)
    if (cached) {
      console.log(`  [${i + 1}/${chunks.length}] cache hit  ${id}`)
      resolved.push({id, text: chunk.text, audioUrl: cached})
      cacheHits += 1
      continue
    }

    console.log(`  [${i + 1}/${chunks.length}] generating ${id} (${chunk.text.length} chars)…`)
    const mp3 = await generateSpeechMp3({
      text: chunk.text,
      voiceId: args.voiceId,
      modelId: args.modelId,
    })
    const url = await uploadVoiceoverMp3(publicId, mp3)
    resolved.push({id, text: chunk.text, audioUrl: url})
    generated += 1
  }

  // Patch the actual storage id (drafts.X or X) — whichever the fetch returned.
  await sanity.patch(post._id).set({voiceoverChunks: resolved}).commit()

  console.log(
    `\nDone. ${generated} generated, ${cacheHits} cached. ${resolved.length} chunks written to post.voiceoverChunks.`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
