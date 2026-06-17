import React from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion'
import type {ArticleVideoProps} from '../types'
// Side-effect import: runs loadFont() so the families behind the Tailwind
// `font-mono` / `font-serif` / `font-sans` utilities are available at render.
import '../fonts'

// Placeholder wordmark — replace with your brand.
const BRAND = 'ACME'

export const ArticleTeaser: React.FC<ArticleVideoProps> = ({
  title,
  authorName,
  excerpt,
  videoCopy,
}) => {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()

  // Phase 1: Tag slides in (0-20)
  const tagSlide = spring({frame, fps, config: {damping: 15, stiffness: 80}})

  // Phase 2: Title reveal (20-60)
  const titleProgress = interpolate(frame, [20, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const titleSlide = spring({
    frame: frame - 20,
    fps,
    config: {damping: 15, stiffness: 60},
  })

  // Phase 3: "New Article" badge slam (60-75)
  const badgeSlam = spring({
    frame: frame - 60,
    fps,
    config: {damping: 8, stiffness: 200},
  })

  // Phase 4: Excerpt (75-95)
  const excerptReveal = spring({
    frame: frame - 75,
    fps,
    config: {damping: 15, stiffness: 80},
  })

  // Phase 5: Author + CTA (95-end)
  const authorReveal = spring({
    frame: frame - 95,
    fps,
    config: {damping: 15, stiffness: 80},
  })

  // Outro
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  )

  // Background flash on badge slam
  const flashOpacity =
    frame >= 60 && frame < 70
      ? interpolate(frame, [60, 70], [0.3, 0], {extrapolateRight: 'clamp'})
      : 0

  return (
    <AbsoluteFill className="bg-foreground font-mono" style={{opacity: outroOpacity}}>
      {/* Flash overlay */}
      <AbsoluteFill className="bg-highlight" style={{opacity: flashOpacity}} />

      {/* Diagonal accent lines (dynamic left offset stays inline) */}
      <AbsoluteFill className="overflow-hidden opacity-5">
        {Array.from({length: 20}).map((_, i) => (
          <div
            key={i}
            className="absolute -top-50 h-600 w-0.5 rotate-30 bg-highlight"
            style={{left: i * 80 - 200}}
          />
        ))}
      </AbsoluteFill>

      {/* Brand watermark */}
      <div
        className="absolute top-7.5 left-10 font-mono text-base font-extrabold tracking-[-0.02em] text-accent uppercase"
        style={{opacity: tagSlide}}
      >
        {BRAND}
      </div>

      {/* Center content */}
      <div className="absolute top-1/2 left-1/2 flex w-4/5 -translate-1/2 flex-col items-center gap-6">
        {/* Tag */}
        <div
          className="border-[3px] border-highlight bg-highlight px-5 py-2 font-mono text-sm font-extrabold tracking-widest text-foreground uppercase"
          style={{
            transform: `translateY(${interpolate(tagSlide, [0, 1], [30, 0])}px)`,
            opacity: tagSlide,
          }}
        >
          {videoCopy?.kicker ?? 'Article'}
        </div>

        {/* Title */}
        <div
          className="text-center font-mono text-5xl leading-[1.1] font-extrabold tracking-[-0.02em] text-background uppercase"
          style={{
            transform: `translateY(${interpolate(titleSlide, [0, 1], [50, 0])}px)`,
            opacity: titleProgress,
          }}
        >
          {videoCopy?.headline ?? title}
        </div>

        {/* "New Article" badge */}
        <div
          className="border-[3px] border-accent bg-accent px-7 py-3 font-mono text-lg font-extrabold tracking-wider text-white uppercase"
          style={{
            transform: `scale(${badgeSlam})`,
            transformOrigin: 'center',
            opacity: badgeSlam,
          }}
        >
          New Article
        </div>

        {/* Excerpt */}
        <div
          className="max-w-175 text-center"
          style={{
            transform: `translateY(${interpolate(excerptReveal, [0, 1], [20, 0])}px)`,
            opacity: excerptReveal,
          }}
        >
          <div className="font-serif text-2xl leading-[1.4] text-background italic">
            &ldquo;{videoCopy?.pullQuote ?? excerpt}&rdquo;
          </div>
        </div>

        {/* Author */}
        <div
          className="mt-4 flex flex-col items-center gap-2"
          style={{
            transform: `translateY(${interpolate(authorReveal, [0, 1], [20, 0])}px)`,
            opacity: authorReveal,
          }}
        >
          <div className="font-mono text-sm font-extrabold tracking-[0.15em] text-muted uppercase">
            By {authorName}
          </div>
          <div className="mt-3 border-[3px] border-background px-6 py-2.5 font-mono text-sm font-extrabold tracking-wider text-background uppercase">
            {videoCopy?.ctaPrimary ?? 'Read more'}
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
    </AbsoluteFill>
  )
}
