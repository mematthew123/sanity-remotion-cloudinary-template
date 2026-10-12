import {z} from 'zod'
import type {CalculateMetadataFunction} from 'remotion'
import {
  ArticleNarratedPropsSchema,
  ArticleVideoPropsSchema,
  type ArticleNarratedProps,
  type ArticleVideoProps,
} from './types'

// =============================================================================
// Variant catalog
// =============================================================================
//
// A "variant" is a Cloudinary derivation of the canonical MP4 render — not a
// re-render. Each variant declares a transformation string (a Cloudinary URL
// segment) and a target format. The render route eager-generates the `eager`
// ones at upload time and stores their URLs on the video doc; the rest derive
// lazily on first request.
//
// React-free: this whole module is metadata only, so the Sanity schema and the
// server render route can import it without pulling Remotion into their bundle.

export type VariantSurface = 'site' | 'youtube' | 'podcast'
export type VariantFormat = 'mp4' | 'gif' | 'jpg' | 'webm' | 'mp3'

export type VariantId =
  | 'site-mp4'
  | 'site-poster-jpg'
  | 'site-preview-gif'
  | 'og-image-jpg'
  // ----- Long-form (article-narrated and any future long-form composition) -
  | 'youtube-1080p-mp4'
  | 'podcast-mp3'

export type VariantDef = {
  id: VariantId
  label: string
  surface: VariantSurface
  format: VariantFormat
  /** Cloudinary transformation segment, e.g. 'w_1080,h_1080,c_fill,g_center'. */
  transformation: string
  /**
   * Still-frame variant: prefix the transformation with `so_<posterSeconds>`
   * from the composition, so the frame is one where the text is fully on
   * screen. A fixed percentage can't do this — 10% of a 7s promo lands before
   * the title animates in, and 10% of a long narrated reading lands in b-roll.
   */
  seekToPoster?: boolean
  width?: number
  height?: number
  /** Generate at upload time via Cloudinary's eager transform list. */
  eager: boolean
}

export const VARIANTS: Record<VariantId, VariantDef> = {
  // ----- Site delivery -----------------------------------------------------
  'site-mp4': {
    id: 'site-mp4',
    label: 'Site MP4',
    surface: 'site',
    format: 'mp4',
    // Adaptive: Cloudinary picks codec + quality per requesting client — which
    // is why it isn't eager: there's no single output to pre-generate. Also the
    // home-feed hover preview (the card keeps its still until playback starts,
    // so a cold first request only delays the preview).
    transformation: 'f_auto,q_auto,vc_auto',
    eager: false,
  },
  'site-poster-jpg': {
    id: 'site-poster-jpg',
    label: 'Site Poster',
    surface: 'site',
    format: 'jpg',
    transformation: 'f_jpg,q_auto',
    seekToPoster: true,
    eager: true,
  },
  'site-preview-gif': {
    id: 'site-preview-gif',
    label: 'Site Preview GIF',
    surface: 'site',
    format: 'gif',
    transformation: 'w_540,du_3,fps_15,fl_lossy,q_70,e_loop,f_gif',
    width: 540,
    // Looping, because email clients can't play video — this is the email hero
    // (newsletter + welcome). Eager: materialized at upload so a send never
    // waits on first-request generation. The home-feed hover plays `site-mp4`.
    eager: true,
  },
  'og-image-jpg': {
    id: 'og-image-jpg',
    label: 'Social Card',
    surface: 'site',
    format: 'jpg',
    // The poster frame padded (never cropped) to the 1.91:1 Open Graph size, so
    // square and vertical renders keep their text in link previews. `b_auto`
    // fills the bars from the frame's border colours (`b_blurred` is
    // video-only and 400s on a still).
    transformation: 'w_1200,h_630,c_pad,b_auto,f_jpg,q_auto',
    seekToPoster: true,
    width: 1200,
    height: 630,
    // Eager: link-preview crawlers time out quickly, so don't make the first
    // share wait on generation.
    eager: true,
  },

  // ----- Long-form: full YouTube upload (the canonical render at 1080p) ---
  'youtube-1080p-mp4': {
    id: 'youtube-1080p-mp4',
    label: 'YouTube 1080p',
    surface: 'youtube',
    format: 'mp4',
    // `c_scale` upscales 720p sources to 1080p (article-narrated renders at
    // 720p to fit inside Vercel's `maxDuration`; Cloudinary handles the scale
    // back up cheaply) and is a no-op for 1080p-native sources. `f_auto,q_auto`
    // lets Cloudinary swap to AV1/HEVC where the client supports it.
    transformation: 'w_1920,h_1080,c_scale,f_auto,q_auto',
    width: 1920,
    height: 1080,
    eager: true,
  },

  // ----- Long-form: podcast (audio-only extraction) -----------------------
  'podcast-mp3': {
    id: 'podcast-mp3',
    label: 'Podcast MP3',
    surface: 'podcast',
    format: 'mp3',
    // `f_mp3` on a video resource asks Cloudinary to serve the audio track
    // only — no re-encode of the video needed; Cloudinary slices the audio
    // from the canonical MP4 on the fly.
    transformation: 'f_mp3',
    eager: true,
  },

}

// Variant groups: SITE_BASE belongs to every composition; LONG_FORM_BASE is
// added by the narrated composition.

const SITE_BASE: readonly VariantId[] = [
  'site-mp4',
  'site-poster-jpg',
  'site-preview-gif',
  'og-image-jpg',
]

// Long-form variants for the narrated composition. Render once → fan out to a
// full-length YouTube upload (720p source upscaled by Cloudinary) and an
// audio-only podcast feed.
const LONG_FORM_BASE: readonly VariantId[] = ['youtube-1080p-mp4', 'podcast-mp3']

// =============================================================================
// Composition catalog
// =============================================================================

export type CompositionId = 'article-promo' | 'article-teaser' | 'article-narrated'

export type SourceType = 'post'

export type CompositionMeta = {
  id: CompositionId
  label: string
  description: string
  sourceType: SourceType
  fps: number
  width: number
  height: number
  isVertical: boolean
  /** Seed duration. `calculateMetadata` overrides at render time when defined. */
  defaultDurationFrames: number
  /**
   * Seconds into the render to grab still-frame variants (poster, social
   * card) — a moment when the title and byline are fully on screen. Keep in
   * sync with the composition's animation timing.
   */
  posterSeconds: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultProps: any
  /** Cloudinary variants this composition opts into (crops that look right). */
  variantIds: readonly VariantId[]
  /**
   * Optional dynamic-duration callback. The ArticleNarrated composition uses
   * this to sum chunk durations into the total frame count — the duration is
   * data-driven (longer post = longer video), not a fixed seed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateMetadata?: CalculateMetadataFunction<any>
}

const articleDefaultProps: ArticleVideoProps = {
  title: 'The Quiet Power of Pre-Rendered Content',
  authorName: 'Jane Doe',
  publishedAt: '2026-01-01T00:00:00.000Z',
  excerpt:
    'Why rendering ahead of time keeps winning — speed, simplicity, and a smaller surface to break.',
}

export const COMPOSITIONS: ReadonlyArray<CompositionMeta> = [
  {
    id: 'article-promo',
    label: 'Article Promo',
    description: 'Square promo card for social feeds',
    sourceType: 'post',
    fps: 30,
    width: 1080,
    height: 1080,
    isVertical: false,
    defaultDurationFrames: 210, // 7s @ 30fps
    // CTA springs in at frame 110 and settles by ~140; outro fade starts at 180.
    posterSeconds: 5,
    schema: ArticleVideoPropsSchema,
    defaultProps: articleDefaultProps,
    variantIds: [...SITE_BASE],
  },
  {
    id: 'article-teaser',
    label: 'Article Teaser',
    description: 'Vertical reel teaser for stories and shorts',
    sourceType: 'post',
    fps: 30,
    width: 1080,
    height: 1920,
    isVertical: true,
    defaultDurationFrames: 180, // 6s @ 30fps
    // Author reveal starts at frame 95 and settles by ~125; outro fade at 160.
    posterSeconds: 4.5,
    schema: ArticleVideoPropsSchema,
    defaultProps: articleDefaultProps,
    variantIds: [...SITE_BASE],
  },
  {
    id: 'article-narrated',
    label: 'Article Narrated',
    description: '720p long-form reading of the post body, with TTS narration (Cloudinary upscales to 1080p for YouTube)',
    sourceType: 'post',
    fps: 30,
    // Rendered at 720p (not 1080p) because each frame on the Vercel Sandbox
    // is CPU-bound — 720p frames are ~2.25× cheaper than 1080p, which is the
    // difference between finishing inside `maxDuration` and stalling. The
    // `youtube-1080p-mp4` Cloudinary variant upscales the canonical render
    // back to 1080p for full-resolution delivery.
    width: 1280,
    height: 720,
    isVertical: false,
    // Studio preview seed only — real duration comes from calculateMetadata.
    defaultDurationFrames: 300,
    // The intro title card holds from frame 8 to 59 before fading into b-roll.
    posterSeconds: 1.5,
    schema: ArticleNarratedPropsSchema,
    defaultProps: {
      title: articleDefaultProps.title,
      authorName: articleDefaultProps.authorName,
      publishedAt: articleDefaultProps.publishedAt,
      brandName: 'The Template',
      kicker: 'Narrated Reading',
      // A stock hero + two b-roll images so the Studio preview shows the
      // documentary cross-dissolve and chapter cards without a real post.
      mainImageUrl:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80&auto=format&fit=crop',
      chapters: [
        {title: 'How it works', chunkIndex: 1},
        {title: 'Why it matters', chunkIndex: 3},
      ],
      images: [
        {
          url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&q=80&auto=format&fit=crop',
          afterChunkIndex: 1,
        },
        {
          url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80&auto=format&fit=crop',
          afterChunkIndex: 3,
        },
      ],
      chunks: [
        {
          id: 'demo-1',
          text: 'A narrated reading of the article plays here — captions live in a real closed-caption track, so the frame stays cinematic.',
          audioUrl: '',
          durationSeconds: 6,
        },
        {
          id: 'demo-2',
          text: 'How it works',
          audioUrl: '',
          durationSeconds: 4,
        },
        {
          id: 'demo-3',
          text: 'Body images cross-dissolve as b-roll while the progress bar and brand lockup stay continuous across the whole reading.',
          audioUrl: '',
          durationSeconds: 7,
        },
        {
          id: 'demo-4',
          text: 'Why it matters',
          audioUrl: '',
          durationSeconds: 4,
        },
        {
          id: 'demo-5',
          text: 'An intro title card opens the video and an outro call-to-action closes it.',
          audioUrl: '',
          durationSeconds: 6,
        },
      ],
    } satisfies ArticleNarratedProps,
    variantIds: [...SITE_BASE, ...LONG_FORM_BASE],
    calculateMetadata: (async ({props}) => {
      const total = (props.chunks ?? []).reduce(
        (sum: number, c: {durationSeconds?: number}) => sum + (c.durationSeconds ?? 0),
        0,
      )
      // Floor at 30 frames (1s @ 30fps) so empty-chunk renders don't divide-by-zero.
      const durationInFrames = Math.max(30, Math.ceil(total * 30))
      return {durationInFrames}
    }) as CalculateMetadataFunction<ArticleNarratedProps>,
  },
]

const COMPOSITIONS_BY_ID: Record<CompositionId, CompositionMeta> =
  Object.fromEntries(COMPOSITIONS.map((c) => [c.id, c])) as Record<
    CompositionId,
    CompositionMeta
  >

export function getComposition(id: CompositionId): CompositionMeta {
  const meta = COMPOSITIONS_BY_ID[id]
  if (!meta) throw new Error(`Unknown composition id: ${id}`)
  return meta
}

/** Soft lookup — returns `undefined` for unknown ids instead of throwing. */
export function findComposition(id: string): CompositionMeta | undefined {
  return COMPOSITIONS_BY_ID[id as CompositionId]
}

export function compositionsForSource(sourceType: SourceType): CompositionMeta[] {
  return COMPOSITIONS.filter((c) => c.sourceType === sourceType)
}

// =============================================================================
// Variant URL + transform helpers
// =============================================================================
//
// `cloudName` is always passed in (never hardcoded) so this package needs no
// Cloudinary env. The render route passes process.env.CLOUDINARY_CLOUD_NAME and
// writes the resulting URLs onto the video doc, so clients read URLs directly.

/** A variant's transformation for one composition (resolves `seekToPoster`). */
export function variantTransformation(variant: VariantDef, composition: CompositionMeta): string {
  return variant.seekToPoster
    ? `so_${composition.posterSeconds},${variant.transformation}`
    : variant.transformation
}

/** Build the public URL for one variant of an uploaded asset. */
export function variantUrl(
  cloudName: string,
  publicId: string,
  variantId: VariantId,
  composition: CompositionMeta,
): string {
  const variant = VARIANTS[variantId]
  if (!variant) throw new Error(`Unknown variant id: ${variantId}`)
  // Source resource type is always 'video' (canonical render is MP4); Cloudinary
  // derives JPG/GIF/WebM from the same video resource.
  const transformation = variantTransformation(variant, composition)
  const segment = transformation
    ? `${transformation}/${publicId}.${variant.format}`
    : `${publicId}.${variant.format}`
  return `https://res.cloudinary.com/${cloudName}/video/upload/${segment}`
}

/**
 * The `eager` array for `cloudinary.uploader.upload_stream` — only the
 * composition's variants flagged `eager: true`; the rest derive on first request.
 *
 * Use `raw_transformation` (not `transformation`): our values are raw Cloudinary
 * transformation strings like `so_10p,f_jpg,q_auto`. Passed under `transformation`
 * the SDK treats them as *named* transformations and Cloudinary 400s with
 * "Unknown transformation so_10p".
 */
export function eagerTransformsFor(
  composition: CompositionMeta,
): Array<{raw_transformation: string; format: VariantFormat}> {
  return composition.variantIds
    .map((id) => VARIANTS[id])
    .filter((v) => v.eager)
    .map((v) => ({raw_transformation: variantTransformation(v, composition), format: v.format}))
}

/** Variants applicable to a composition, optionally filtered by surface. */
export function variantsForComposition(
  compositionId: CompositionId,
  surface?: VariantSurface,
): VariantDef[] {
  return getComposition(compositionId)
    .variantIds.map((id) => VARIANTS[id])
    .filter((v) => !surface || v.surface === surface)
}

export type VariantSnapshot = {
  /** Stable array key for Sanity — unique per array, derived from the variant id. */
  _key: string
  variantId: VariantId
  surface: VariantSurface
  format: VariantFormat
  url: string
  width?: number
  height?: number
}

/**
 * Snapshot of every variant URL for an upload of a composition. The render
 * route writes this to the `video.variants[]` field after upload (shape matches
 * the Sanity schema).
 */
export function snapshotVariants(
  cloudName: string,
  publicId: string,
  composition: CompositionMeta,
): VariantSnapshot[] {
  return composition.variantIds.map((id) => {
    const variant = VARIANTS[id]
    return {
      _key: id,
      variantId: id,
      surface: variant.surface,
      format: variant.format,
      url: variantUrl(cloudName, publicId, id, composition),
      width: variant.width,
      height: variant.height,
    }
  })
}

// =============================================================================
// Narration / voiceover
// =============================================================================
//
// Re-exported here so the generate-voiceover CLI and the future render route
// can pull these from `@template/video-core/registry` without dragging React
// into their bundles. The chunker is pure; the hashing/upload logic lives in
// the CLI itself (in apps/web) to keep video-core free of Node-only deps.

export {chunkPortableTextForNarration, extractNarrationScenes} from './voiceover/chunk'
export type {NarrationChapter, NarrationImage, NarrationScenes} from './voiceover/chunk'
export type {Chunk, ResolvedChunk, WordTiming} from './voiceover/types'
