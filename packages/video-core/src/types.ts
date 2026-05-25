import {z} from 'zod'

/**
 * Optional per-article copy slots. The Sanity "Generate video copy in brand
 * voice" Assist action fills these from the post; compositions fall back to the
 * base article fields (title/excerpt) when a slot is empty. Every field is
 * optional so the schema stays backwards-compatible with the minimal template.
 */
export const VideoCopySchema = z.object({
  /** Short label above the title, e.g. a category or "New Article". */
  kicker: z.string().optional(),
  /** Overrides the title on the video when set. */
  headline: z.string().optional(),
  /** One supporting line under the title. */
  subhead: z.string().optional(),
  /** Short quote/standout line, used by the vertical teaser. */
  pullQuote: z.string().optional(),
  /** Primary call to action, e.g. "Read more". */
  ctaPrimary: z.string().optional(),
  /** Optional second CTA line that can undercut/expand the first. */
  ctaSecondary: z.string().optional(),
})

export type VideoCopy = z.infer<typeof VideoCopySchema>

/**
 * The single props contract every composition renders from. The Sanity "Render"
 * action / video app assembles this from a `post` document; the render route
 * re-validates it with this schema before handing it to Remotion.
 */
export const ArticleVideoPropsSchema = z.object({
  title: z.string(),
  authorName: z.string(),
  publishedAt: z.string(),
  excerpt: z.string(),
  mainImageUrl: z.string().optional(),
  videoCopy: VideoCopySchema.optional(),
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
