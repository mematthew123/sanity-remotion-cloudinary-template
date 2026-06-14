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

export type VariantSurface = 'site' | 'social' | 'youtube' | 'podcast'
export type VariantFormat = 'mp4' | 'gif' | 'jpg' | 'webm' | 'mp3'

export type VariantId =
  | 'site-mp4'
  | 'site-poster-jpg'
  | 'site-preview-gif'
  | 'social-1x1'
  | 'social-square-mp4'
  | 'social-vertical-mp4'
  // ----- Long-form (article-narrated and any future long-form composition) -
  | 'youtube-1080p-mp4'
  | 'podcast-mp3'
  | 'longform-tiktok-30s-mp4'
  | 'longform-shorts-60s-mp4'

export type VariantDef = {
  id: VariantId
  label: string
  surface: VariantSurface
  format: VariantFormat
  /** Cloudinary transformation segment, e.g. 'w_1080,h_1080,c_fill,g_center'. */
  transformation: string
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
    // Adaptive: Cloudinary picks codec + quality per requesting client.
    transformation: 'f_auto,q_auto,vc_auto',
    eager: false,
  },
  'site-poster-jpg': {
    id: 'site-poster-jpg',
    label: 'Site Poster',
    surface: 'site',
    format: 'jpg',
    transformation: 'so_10p,f_jpg,q_auto',
    eager: true,
  },
  'site-preview-gif': {
    id: 'site-preview-gif',
    label: 'Site Preview GIF',
    surface: 'site',
    format: 'gif',
    transformation: 'w_540,du_3,fps_15,fl_lossy,q_70,f_gif',
    width: 540,
    eager: false,
  },

  // ----- Social: automation-friendly square image (BlueSky Blueprint) ------
  // Consumed by the bluesky-post Blueprint function, which uploads the URL as
  // an *image* embed (1 MB cap) — so this must stay an image format, not an
  // MP4 crop. Square animated GIF: same lossy budget as `site-preview-gif`,
  // center-cropped to 1:1 for timeline composition.
  'social-1x1': {
    id: 'social-1x1',
    label: 'Social Square GIF',
    surface: 'social',
    format: 'gif',
    transformation: 'w_540,h_540,c_fill,g_center,du_3,fps_15,fl_lossy,q_70,f_gif',
    width: 540,
    height: 540,
    eager: false,
  },

  // ----- Social: square (1:1) ---------------------------------------------
  // One representative square crop. Instagram/Twitter/Facebook all want the
  // same 1080×1080 center-crop, so a single derivation covers every square
  // platform — no per-network duplicates to materialize.
  'social-square-mp4': {
    id: 'social-square-mp4',
    label: 'Social Square',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1080,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1080,
    eager: true,
  },

  // ----- Social: vertical (9:16) ------------------------------------------
  // One representative vertical crop for Reels / TikTok / Shorts — all share
  // the same 1080×1920 center-crop.
  'social-vertical-mp4': {
    id: 'social-vertical-mp4',
    label: 'Social Vertical',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1920,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1920,
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

  // ----- Long-form: short-form snippets (first N seconds, vertical) -------
  // `du_<seconds>` trims the duration starting from the beginning of the
  // video; `c_fill,g_center` crops 16:9 → 9:16. The two variants differ only
  // in clip length so platforms with different limits each get a usable cut
  // without re-rendering.
  'longform-tiktok-30s-mp4': {
    id: 'longform-tiktok-30s-mp4',
    label: 'TikTok 30s Clip',
    surface: 'social',
    format: 'mp4',
    transformation: 'du_30,c_fill,g_center,w_1080,h_1920,f_mp4,q_auto',
    width: 1080,
    height: 1920,
    eager: true,
  },
  'longform-shorts-60s-mp4': {
    id: 'longform-shorts-60s-mp4',
    label: 'YouTube Shorts 60s Clip',
    surface: 'social',
    format: 'mp4',
    transformation: 'du_60,c_fill,g_center,w_1080,h_1920,f_mp4,q_auto',
    width: 1080,
    height: 1920,
    eager: true,
  },
}

// Variant groups, by the release-series installment that ships them:
// SITE_BASE + the platform crops belong to the core template; BLUEPRINT_SOCIAL
// arrives with the BlueSky Blueprint installment; LONG_FORM_BASE with the
// narrated installment. Each group is a clean append for its installment.

const SITE_BASE: readonly VariantId[] = ['site-mp4', 'site-poster-jpg', 'site-preview-gif']

// Consumed by the bluesky-post Blueprint function. On every composition so any
// ready video can be auto-posted.
const BLUEPRINT_SOCIAL: readonly VariantId[] = ['social-1x1']

// Long-form variants for the narrated composition. Render once → fan out to
// YouTube full-length, audio-only podcast feed, and short-form social clips
// auto-cut from the head of the video.
const LONG_FORM_BASE: readonly VariantId[] = [
  'youtube-1080p-mp4',
  'podcast-mp3',
  'longform-tiktok-30s-mp4',
  'longform-shorts-60s-mp4',
]
// One representative crop per aspect ratio — the per-platform transforms were
// byte-identical, so a single square / single vertical derivation covers them
// all without re-materializing the same crop under different names.
const SQUARE_SOCIAL: readonly VariantId[] = ['social-square-mp4']
const VERTICAL_SOCIAL: readonly VariantId[] = ['social-vertical-mp4']

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
    schema: ArticleVideoPropsSchema,
    defaultProps: articleDefaultProps,
    variantIds: [...SITE_BASE, ...SQUARE_SOCIAL, ...BLUEPRINT_SOCIAL],
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
    schema: ArticleVideoPropsSchema,
    defaultProps: articleDefaultProps,
    variantIds: [...SITE_BASE, ...VERTICAL_SOCIAL, ...BLUEPRINT_SOCIAL],
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
    schema: ArticleNarratedPropsSchema,
    defaultProps: {
      title: articleDefaultProps.title,
      authorName: articleDefaultProps.authorName,
      publishedAt: articleDefaultProps.publishedAt,
      chunks: [
        {
          id: 'demo-1',
          text: 'A narrated reading of the article would play here.',
          audioUrl: '',
          durationSeconds: 5,
        },
      ],
    } satisfies ArticleNarratedProps,
    variantIds: [...SITE_BASE, ...LONG_FORM_BASE, ...BLUEPRINT_SOCIAL],
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

/** Build the public URL for one variant of an uploaded asset. */
export function variantUrl(cloudName: string, publicId: string, variantId: VariantId): string {
  const variant = VARIANTS[variantId]
  if (!variant) throw new Error(`Unknown variant id: ${variantId}`)
  // Source resource type is always 'video' (canonical render is MP4); Cloudinary
  // derives JPG/GIF/WebM from the same video resource.
  const segment = variant.transformation
    ? `${variant.transformation}/${publicId}.${variant.format}`
    : `${publicId}.${variant.format}`
  return `https://res.cloudinary.com/${cloudName}/video/upload/${segment}`
}

/**
 * The `eager` array for `cloudinary.uploader.upload_stream` — only variants
 * flagged `eager: true`; the rest derive on first request.
 *
 * Use `raw_transformation` (not `transformation`): our values are raw Cloudinary
 * transformation strings like `so_10p,f_jpg,q_auto`. Passed under `transformation`
 * the SDK treats them as *named* transformations and Cloudinary 400s with
 * "Unknown transformation so_10p".
 */
export function eagerTransformsFor(
  variantIds: readonly VariantId[],
): Array<{raw_transformation: string; format: VariantFormat}> {
  return variantIds
    .map((id) => VARIANTS[id])
    .filter((v) => v.eager)
    .map((v) => ({raw_transformation: v.transformation, format: v.format}))
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
  variantId: VariantId
  surface: VariantSurface
  format: VariantFormat
  url: string
  width?: number
  height?: number
}

/**
 * Snapshot of every variant URL for an upload. The render route writes this to
 * the `video.variants[]` field after upload (shape matches the Sanity schema).
 */
export function snapshotVariants(
  cloudName: string,
  publicId: string,
  variantIds: readonly VariantId[],
): VariantSnapshot[] {
  return variantIds.map((id) => {
    const variant = VARIANTS[id]
    return {
      variantId: id,
      surface: variant.surface,
      format: variant.format,
      url: variantUrl(cloudName, publicId, id),
      width: variant.width,
      height: variant.height,
    }
  })
}

// =============================================================================
// Narration / voiceover (Phase 1 of PLAN-narrated-videos.md)
// =============================================================================
//
// Re-exported here so the generate-voiceover CLI and the future render route
// can pull these from `@template/video-core/registry` without dragging React
// into their bundles. The chunker is pure; the hashing/upload logic lives in
// the CLI itself (in apps/web) to keep video-core free of Node-only deps.

export {chunkPortableTextForNarration} from './voiceover/chunk'
export type {Chunk, ResolvedChunk} from './voiceover/types'
