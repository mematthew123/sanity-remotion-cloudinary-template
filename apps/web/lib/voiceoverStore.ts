// Cloudinary read/write helpers for voiceover MP3s. We store MP3s under a
// deterministic `voiceover/{postId}/{chunkId}` public_id so repeated renders
// of the same post hit cache and don't re-bill ElevenLabs.
//
// Cloudinary treats audio as `resource_type: 'video'` — same upload pipeline
// as MP4s, just a different format. The `existing*` helpers let the CLI skip
// the TTS call when the MP3 is already in the bucket.

import {createHash} from 'node:crypto'
import {v2 as cloudinary, type UploadApiResponse} from 'cloudinary'

export function configureCloudinaryFromEnv(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

/** Cache key for a chunk. Stable across renders: same text + voice + model
 *  → same id → Cloudinary cache hit. 16 hex chars (~64 bits) is plenty for a
 *  per-post namespace and reads nicer in the Cloudinary console than 64. */
export function computeChunkId(text: string, voiceId: string, modelId: string): string {
  return createHash('sha256')
    .update(JSON.stringify({text, voiceId, modelId}))
    .digest('hex')
    .slice(0, 16)
}

export function voiceoverPublicId(postId: string, chunkId: string): string {
  return `voiceover/${postId}/${chunkId}`
}

export type VoiceoverUpload = {
  url: string
  /** Audio duration in seconds, as reported by Cloudinary. Drives the
   *  composition's calculateMetadata so total length is known sync. */
  durationSeconds: number
}

/** Returns `{url, durationSeconds}` if an MP3 already exists at this public_id,
 *  or `null` if not. Any other Cloudinary error bubbles up — the script should
 *  fail loud rather than silently re-bill ElevenLabs. */
export async function existingVoiceoverUrl(publicId: string): Promise<VoiceoverUpload | null> {
  try {
    // `media_metadata: true` is required to get `duration` in the response —
    // without it Cloudinary omits the field even for video-type audio assets.
    const res = await cloudinary.api.resource(publicId, {
      resource_type: 'video',
      media_metadata: true,
    })
    return {
      url: res.secure_url as string,
      durationSeconds: typeof res.duration === 'number' ? res.duration : 0,
    }
  } catch (err) {
    // SDK shape: `{error: {http_code: 404, message}}` for "not found".
    // Some older versions put `http_code` at the top level — check both.
    const e = err as {http_code?: number; error?: {http_code?: number}}
    const code = e?.http_code ?? e?.error?.http_code
    if (code === 404) return null
    throw err
  }
}

/** Upload an MP3 buffer to a deterministic Cloudinary public_id. Resolves to
 *  `{url, durationSeconds}` — Cloudinary returns the audio duration in the
 *  upload response for `resource_type: 'video'` audio assets. */
export function uploadVoiceoverMp3(publicId: string, mp3: Buffer): Promise<VoiceoverUpload> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'video',
        format: 'mp3',
        // Allow re-upload at the same public_id when the chunk id collides
        // (theoretically possible across voice/model swaps — practically never).
        overwrite: true,
      },
      (err, result: UploadApiResponse | undefined) => {
        if (err) return reject(err)
        if (!result?.secure_url) return reject(new Error('Cloudinary returned no URL'))
        // `duration` isn't on UploadApiResponse's TS type, but Cloudinary
        // populates it for video-type uploads at runtime. Read defensively.
        const duration = (result as unknown as {duration?: unknown}).duration
        resolve({
          url: result.secure_url,
          durationSeconds: typeof duration === 'number' ? duration : 0,
        })
      },
    )
    stream.end(mp3)
  })
}
