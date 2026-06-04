// Thin wrapper around ElevenLabs TTS REST API. Returns an MP3 buffer per call.
// No SDK dependency — `fetch` keeps the surface narrow and lets us swap the
// provider later without touching callers.

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
 *  preview in the Studio Send dialog (Phase 5). Pay-as-you-go pricing is ~$0.30
 *  per 1000 characters at time of writing; pinned-tier subscribers should swap
 *  this constant. Reference: https://elevenlabs.io/pricing */
const USD_PER_1000_CHARS = 0.3

export function estimateSpeechCostUsd(charCount: number): number {
  return (charCount / 1000) * USD_PER_1000_CHARS
}
