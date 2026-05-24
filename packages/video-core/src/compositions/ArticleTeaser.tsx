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
import {COLORS} from '../types'
import {fonts, borderBrutal, headline, accent} from '../styles'

// Placeholder wordmark — replace with your brand.
const BRAND = 'ACME'

export const ArticleTeaser: React.FC<ArticleVideoProps> = ({
  title,
  authorName,
  excerpt,
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
  const flashOpacity = frame >= 60 && frame < 70
    ? interpolate(frame, [60, 70], [0.3, 0], {extrapolateRight: 'clamp'})
    : 0

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.foreground,
        fontFamily: fonts.mono,
        opacity: outroOpacity,
      }}
    >
      {/* Flash overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.highlight,
          opacity: flashOpacity,
        }}
      />

      {/* Diagonal accent lines */}
      <AbsoluteFill style={{overflow: 'hidden', opacity: 0.05}}>
        {Array.from({length: 20}).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: -200,
              left: i * 80 - 200,
              width: 2,
              height: 2400,
              backgroundColor: COLORS.highlight,
              transform: 'rotate(30deg)',
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Brand watermark */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 40,
          ...headline(16),
          color: COLORS.accent,
          opacity: tagSlide,
        }}
      >
        {BRAND}
      </div>

      {/* Center content */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          width: '80%',
        }}
      >
        {/* Tag */}
        <div
          style={{
            padding: '8px 20px',
            backgroundColor: COLORS.highlight,
            color: COLORS.foreground,
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            ...borderBrutal,
            borderColor: COLORS.highlight,
            transform: `translateY(${interpolate(tagSlide, [0, 1], [30, 0])}px)`,
            opacity: tagSlide,
          }}
        >
          Article
        </div>

        {/* Title */}
        <div
          style={{
            ...headline(48),
            color: COLORS.background,
            textAlign: 'center',
            lineHeight: 1.1,
            transform: `translateY(${interpolate(titleSlide, [0, 1], [50, 0])}px)`,
            opacity: titleProgress,
          }}
        >
          {title}
        </div>

        {/* "New Article" badge */}
        <div
          style={{
            padding: '12px 28px',
            backgroundColor: COLORS.accent,
            color: '#FFFFFF',
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            ...borderBrutal,
            borderColor: COLORS.accent,
            transform: `scale(${badgeSlam})`,
            transformOrigin: 'center',
            opacity: badgeSlam,
          }}
        >
          New Article
        </div>

        {/* Excerpt */}
        <div
          style={{
            maxWidth: 700,
            textAlign: 'center',
            transform: `translateY(${interpolate(excerptReveal, [0, 1], [20, 0])}px)`,
            opacity: excerptReveal,
          }}
        >
          <div
            style={{
              ...accent(24),
              color: COLORS.background,
              lineHeight: 1.4,
            }}
          >
            &ldquo;{excerpt}&rdquo;
          </div>
        </div>

        {/* Author */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            transform: `translateY(${interpolate(authorReveal, [0, 1], [20, 0])}px)`,
            opacity: authorReveal,
          }}
        >
          <div
            style={{
              ...headline(14),
              color: COLORS.muted,
              letterSpacing: '0.15em',
            }}
          >
            By {authorName}
          </div>
          <div
            style={{
              marginTop: 12,
              padding: '10px 24px',
              border: `3px solid ${COLORS.background}`,
              fontFamily: fonts.mono,
              fontWeight: 800,
              fontSize: 14,
              color: COLORS.background,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Read more
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: COLORS.accent,
        }}
      />
    </AbsoluteFill>
  )
}
