import {z} from 'zod'
import {ArticleVideoPropsSchema, type ArticleVideoProps} from './types'

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

export type VariantSurface = 'site' | 'social'
export type VariantFormat = 'mp4' | 'gif' | 'jpg' | 'webm'

export type VariantId =
  | 'site-mp4'
  | 'site-poster-jpg'
  | 'site-preview-gif'
  | 'instagram-square-mp4'
  | 'twitter-square-mp4'
  | 'facebook-square-mp4'
  | 'instagram-reel-mp4'
  | 'tiktok-mp4'
  | 'youtube-short-mp4'
  | 'youtube-thumbnail-jpg'

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

  // ----- Social: square (1:1) ---------------------------------------------
  'instagram-square-mp4': {
    id: 'instagram-square-mp4',
    label: 'Instagram Square',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1080,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1080,
    eager: true,
  },
  'twitter-square-mp4': {
    id: 'twitter-square-mp4',
    label: 'Twitter/X Square',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1080,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1080,
    eager: true,
  },
  'facebook-square-mp4': {
    id: 'facebook-square-mp4',
    label: 'Facebook Square',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1080,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1080,
    eager: true,
  },

  // ----- Social: vertical (9:16) ------------------------------------------
  'instagram-reel-mp4': {
    id: 'instagram-reel-mp4',
    label: 'Instagram Reel',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1920,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1920,
    eager: true,
  },
  'tiktok-mp4': {
    id: 'tiktok-mp4',
    label: 'TikTok',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1920,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1920,
    eager: true,
  },
  'youtube-short-mp4': {
    id: 'youtube-short-mp4',
    label: 'YouTube Short',
    surface: 'social',
    format: 'mp4',
    transformation: 'w_1080,h_1920,c_fill,g_center,f_mp4,q_auto',
    width: 1080,
    height: 1920,
    eager: true,
  },

  // ----- Social: thumbnail ------------------------------------------------
  'youtube-thumbnail-jpg': {
    id: 'youtube-thumbnail-jpg',
    label: 'YouTube Thumbnail',
    surface: 'social',
    format: 'jpg',
    transformation: 'w_1280,h_720,c_fill,g_center,so_10p,f_jpg,q_auto',
    width: 1280,
    height: 720,
    eager: true,
  },
}

const SITE_BASE: readonly VariantId[] = ['site-mp4', 'site-poster-jpg', 'site-preview-gif']
const SQUARE_SOCIAL: readonly VariantId[] = [
  'instagram-square-mp4',
  'twitter-square-mp4',
  'facebook-square-mp4',
]
const VERTICAL_SOCIAL: readonly VariantId[] = [
  'instagram-reel-mp4',
  'tiktok-mp4',
  'youtube-short-mp4',
]

// =============================================================================
// Composition catalog
// =============================================================================

export type CompositionId = 'article-promo' | 'article-teaser'

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
  defaultDurationFrames: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any>
  defaultProps: ArticleVideoProps
  /** Cloudinary variants this composition opts into (crops that look right). */
  variantIds: readonly VariantId[]
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
    variantIds: [...SITE_BASE, ...SQUARE_SOCIAL],
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
    variantIds: [...SITE_BASE, ...VERTICAL_SOCIAL],
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
