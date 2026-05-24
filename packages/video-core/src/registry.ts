import {z} from 'zod'
import {ArticleVideoPropsSchema, type ArticleVideoProps} from './types'

// =============================================================================
// Composition catalog
// =============================================================================
//
// Pure metadata — NO React imports — so the Sanity schema layer and the server
// render route can read this without pulling Remotion into their bundle.
// Component references live in `registry-components.ts` and are imported only
// by render contexts (the Remotion bundle entry).

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
  // ZodObject is what Remotion's <Composition schema={...}> wants.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any>
  defaultProps: ArticleVideoProps
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
