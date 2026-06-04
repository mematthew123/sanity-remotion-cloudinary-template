// Shapes shared between the generate-voiceover CLI, the (future) render route
// validation, and the (future) ArticleNarrated composition. Kept dependency-
// free so this module stays importable from both the React-free registry
// path and the Remotion-component path.

/** One paragraph of narratable text — what the chunker emits. */
export type Chunk = {
  text: string
}

/**
 * A chunk after the generate-voiceover step has resolved it: deterministic
 * cache id, Cloudinary-hosted MP3 URL, and the duration in seconds captured
 * from Cloudinary's video metadata. The duration lets the composition's
 * `calculateMetadata` sum scene lengths synchronously without a remote probe.
 *
 * The `id` is computed externally (in apps/web/scripts/generate-voiceover.ts)
 * as `sha256(JSON.stringify({text, voiceId, modelId}))` — putting the hashing
 * in the script avoids dragging `node:crypto` into video-core, which still
 * needs to be Studio-bundle-safe (browser).
 */
export type ResolvedChunk = Chunk & {
  id: string
  audioUrl: string
  durationSeconds: number
}
