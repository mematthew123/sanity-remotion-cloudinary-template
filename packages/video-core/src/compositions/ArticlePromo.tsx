import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Img,
} from 'remotion'
import type {ArticleVideoProps} from '../types'
// Side-effect import: runs loadFont() so the families behind the Tailwind
// `font-mono` / `font-serif` / `font-sans` utilities are available at render.
import '../fonts'

// Placeholder wordmark — replace with your brand.
const BRAND = 'ACME'

// Brutalist border + hard offset shadow as reusable Tailwind class strings.
const BORDER = 'border-[3px] border-foreground'
const SHADOW = 'shadow-[4px_4px_0px_var(--color-foreground)]'

export const ArticlePromo: React.FC<ArticleVideoProps> = ({
  title,
  authorName,
  publishedAt,
  excerpt,
  mainImageUrl,
  videoCopy,
}) => {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()

  const introSlide = spring({frame, fps, config: {damping: 15, stiffness: 60}})
  const tagPop = spring({frame: frame - 20, fps, config: {damping: 10, stiffness: 120}})
  const titleReveal = spring({frame: frame - 30, fps, config: {damping: 15, stiffness: 70}})
  const excerptReveal = spring({frame: frame - 70, fps, config: {damping: 15, stiffness: 80}})
  const authorReveal = spring({frame: frame - 90, fps, config: {damping: 15, stiffness: 80}})
  const ctaReveal = spring({frame: frame - 110, fps, config: {damping: 12, stiffness: 100}})

  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const formattedDate = (() => {
    try {
      return new Date(publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return publishedAt
    }
  })()

  return (
    <AbsoluteFill className="bg-background font-sans" style={{opacity: outroOpacity}}>
      {/* Background grid pattern (complex multi-gradient — inline) */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage:
            'linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header bar */}
      <Sequence from={0}>
        <div
          className="absolute inset-x-0 top-0 flex h-[60px] items-center justify-between bg-foreground px-10"
          style={{transform: `translateY(${interpolate(introSlide, [0, 1], [-60, 0])}px)`}}
        >
          <div className="font-mono text-xl font-extrabold uppercase tracking-[0.05em] text-accent">
            {BRAND}
          </div>
          <div className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-highlight">
            Article
          </div>
        </div>
      </Sequence>

      {/* Main content */}
      <div className="absolute inset-x-10 bottom-[60px] top-20 flex flex-col gap-6">
        {/* Main image */}
        {mainImageUrl && (
          <Sequence from={5} layout="none">
            <div
              className={`h-[340px] w-full overflow-hidden ${BORDER} ${SHADOW}`}
              style={{
                transform: `translateY(${interpolate(introSlide, [0, 1], [40, 0])}px)`,
                opacity: introSlide,
              }}
            >
              <Img src={mainImageUrl} className="h-full w-full object-cover" />
            </div>
          </Sequence>
        )}

        {/* Tag */}
        <Sequence from={20} layout="none">
          <div
            className={`inline-flex self-start bg-highlight px-[14px] py-[6px] font-mono text-xs font-extrabold uppercase tracking-[0.05em] text-foreground ${BORDER}`}
            style={{transform: `scale(${tagPop})`, transformOrigin: 'left center'}}
          >
            {videoCopy?.kicker ?? 'New Article'}
          </div>
        </Sequence>

        {/* Title */}
        <Sequence from={30} layout="none">
          <div
            className={`font-mono font-extrabold uppercase leading-[1.1] tracking-[-0.02em] text-foreground ${
              mainImageUrl ? 'text-4xl' : 'text-5xl'
            }`}
            style={{
              transform: `translateY(${interpolate(titleReveal, [0, 1], [30, 0])}px)`,
              opacity: titleReveal,
            }}
          >
            {videoCopy?.headline ?? title}
          </div>
        </Sequence>

        {/* Excerpt */}
        <Sequence from={70} layout="none">
          <div
            className="line-clamp-3 font-serif text-[22px] italic leading-[1.4] text-muted"
            style={{
              transform: `translateY(${interpolate(excerptReveal, [0, 1], [20, 0])}px)`,
              opacity: excerptReveal,
            }}
          >
            &ldquo;{videoCopy?.pullQuote ?? excerpt}&rdquo;
          </div>
        </Sequence>

        {/* Author + Date */}
        <Sequence from={90} layout="none">
          <div
            className="mt-auto flex items-center justify-between"
            style={{
              transform: `translateY(${interpolate(authorReveal, [0, 1], [20, 0])}px)`,
              opacity: authorReveal,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-10 items-center justify-center bg-accent font-mono text-lg font-extrabold text-white ${BORDER}`}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted">
                  By
                </div>
                <div className="font-mono text-base font-extrabold uppercase tracking-[-0.02em] text-foreground">
                  {authorName}
                </div>
              </div>
            </div>
            <div className="font-sans text-sm text-muted">{formattedDate}</div>
          </div>
        </Sequence>

        {/* CTA */}
        <Sequence from={110} layout="none">
          <div
            className={`flex items-center justify-between bg-foreground px-6 py-[14px] ${BORDER}`}
            style={{
              transform: `translateY(${interpolate(ctaReveal, [0, 1], [30, 0])}px)`,
              opacity: ctaReveal,
            }}
          >
            <div className="font-mono text-sm font-extrabold uppercase tracking-[0.05em] text-background">
              {videoCopy?.ctaPrimary ?? 'Read more'}
            </div>
            <div className="font-mono text-2xl text-accent">&rarr;</div>
          </div>
        </Sequence>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
    </AbsoluteFill>
  )
}
