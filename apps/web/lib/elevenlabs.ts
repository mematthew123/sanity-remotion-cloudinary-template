// Thin wrapper around ElevenLabs TTS REST API. Returns an MP3 buffer per call.
// No SDK dependency — `fetch` keeps the surface narrow and lets us swap the
// provider later without touching callers.

import type {WordTiming} from '@template/video-core/registry'

export type GenerateSpeechArgs = {
  text: string
  voiceId: string
  /** Defaults to the multilingual v2 model — best quality / cost tradeoff today. */
  modelId?: string
  /**
   * Per-call voice settings. Defaults are tuned for spoken-word narration of
   * blog posts: stable-ish prosody, moderate similarity, gentle style flair.
   */
  voiceSettings?: {
    stability?: number
    similarity_boost?: number
    style?: number
    use_speaker_boost?: boolean
  }
}

const DEFAULT_MODEL = 'eleven_multilingual_v2'
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
}

export async function generateSpeechMp3(args: GenerateSpeechArgs): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set. Add it to apps/web/.env.local.')
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: args.text,
      model_id: args.modelId ?? DEFAULT_MODEL,
      voice_settings: {...DEFAULT_VOICE_SETTINGS, ...args.voiceSettings},
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${errBody.slice(0, 500)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

/** Rough cost estimate ($USD) for an ElevenLabs TTS call, used by the cost
 *  preview in the Studio Send dialog. Pay-as-you-go pricing is ~$0.30
 *  per 1000 characters at time of writing; pinned-tier subscribers should swap
 *  this constant. Reference: https://elevenlabs.io/pricing */
const USD_PER_1000_CHARS = 0.3

export function estimateSpeechCostUsd(charCount: number): number {
  return (charCount / 1000) * USD_PER_1000_CHARS
}

type ForcedAlignmentResponse = {
  words?: Array<{text?: string; start?: number; end?: number}>
}

/**
 * Word-level timestamps for an existing MP3 via ElevenLabs forced alignment
 * (`POST /v1/forced-alignment`, multipart `file` + `text`). Returns times
 * relative to the clip's own start. Used to upgrade the narrated reading's
 * closed captions from paragraph-level to word-level cues — it does NOT
 * regenerate audio, so the canonical MP3 and its Cloudinary cache are untouched.
 *
 * Reference (verified): https://elevenlabs.io/docs/api-reference/forced-alignment/create
 */
export async function forceAlignWords(audio: Buffer, text: string): Promise<WordTiming[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set. Add it to apps/web/.env.local.')
  }

  const form = new FormData()
  // Let fetch set the multipart boundary — do NOT set Content-Type manually.
  form.append('file', new Blob([new Uint8Array(audio)], {type: 'audio/mpeg'}), 'chunk.mp3')
  form.append('text', text)

  const res = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {'xi-api-key': apiKey},
    body: form,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`ElevenLabs forced-alignment ${res.status} ${res.statusText}: ${errBody.slice(0, 500)}`)
  }

  const data = (await res.json()) as ForcedAlignmentResponse
  return (data.words ?? [])
    .filter((w) => typeof w.text === 'string' && typeof w.start === 'number' && typeof w.end === 'number')
    .map((w) => ({text: w.text as string, start: w.start as number, end: w.end as number}))
}
