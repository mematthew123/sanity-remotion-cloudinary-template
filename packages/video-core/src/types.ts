import {z} from 'zod'

/**
 * The single props contract every composition renders from. The Sanity "Render"
 * action assembles this object from a `post` document; the render route
 * re-validates it with this schema before handing it to Remotion.
 */
export const ArticleVideoPropsSchema = z.object({
  title: z.string(),
  authorName: z.string(),
  publishedAt: z.string(),
  excerpt: z.string(),
  mainImageUrl: z.string().optional(),
})

export type ArticleVideoProps = z.infer<typeof ArticleVideoPropsSchema>

/** Neutral palette — swap these for your brand. */
export const COLORS = {
  background: '#F5F4F0',
  foreground: '#141414',
  accent: '#3B5BDB',
  highlight: '#FFD43B',
  muted: '#6B7280',
} as const
