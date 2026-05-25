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
import {COLORS} from '../types'
import {fonts, borderBrutal, shadowBrutal, headline, label, accent, body} from '../styles'

// Placeholder wordmark — replace with your brand.
const BRAND = 'ACME'

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

  const tagPop = spring({
    frame: frame - 20,
    fps,
    config: {damping: 10, stiffness: 120},
  })

  const titleReveal = spring({
    frame: frame - 30,
    fps,
    config: {damping: 15, stiffness: 70},
  })

  const excerptReveal = spring({
    frame: frame - 70,
    fps,
    config: {damping: 15, stiffness: 80},
  })

  const authorReveal = spring({
    frame: frame - 90,
    fps,
    config: {damping: 15, stiffness: 80},
  })

  const ctaReveal = spring({
    frame: frame - 110,
    fps,
    config: {damping: 12, stiffness: 100},
  })

  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  )

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
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: fonts.body,
        opacity: outroOpacity,
      }}
    >
      {/* Background grid pattern */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: `
            linear-gradient(${COLORS.foreground} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.foreground} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header bar */}
      <Sequence from={0}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: COLORS.foreground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 40px',
            transform: `translateY(${interpolate(introSlide, [0, 1], [-60, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 800,
              fontSize: 20,
              color: COLORS.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {BRAND}
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 14,
              color: COLORS.highlight,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Article
          </div>
        </div>
      </Sequence>

      {/* Main content */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 40,
          right: 40,
          bottom: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Main image */}
        {mainImageUrl && (
          <Sequence from={5}>
            <div
              style={{
                width: '100%',
                height: 340,
                ...borderBrutal,
                ...shadowBrutal,
                overflow: 'hidden',
                transform: `translateY(${interpolate(introSlide, [0, 1], [40, 0])}px)`,
                opacity: introSlide,
              }}
            >
              <Img
                src={mainImageUrl}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </div>
          </Sequence>
        )}

        {/* Tag */}
        <Sequence from={20}>
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              padding: '6px 14px',
              backgroundColor: COLORS.highlight,
              color: COLORS.foreground,
              fontFamily: fonts.mono,
              fontWeight: 800,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              ...borderBrutal,
              transform: `scale(${tagPop})`,
              transformOrigin: 'left center',
            }}
          >
            {videoCopy?.kicker ?? 'New Article'}
          </div>
        </Sequence>

        {/* Title */}
        <Sequence from={30}>
          <div
            style={{
              ...headline(mainImageUrl ? 36 : 48),
              lineHeight: 1.1,
              transform: `translateY(${interpolate(titleReveal, [0, 1], [30, 0])}px)`,
              opacity: titleReveal,
            }}
          >
            {videoCopy?.headline ?? title}
          </div>
        </Sequence>

        {/* Excerpt */}
        <Sequence from={70}>
          <div
            style={{
              ...accent(22),
              color: COLORS.muted,
              lineHeight: 1.4,
              transform: `translateY(${interpolate(excerptReveal, [0, 1], [20, 0])}px)`,
              opacity: excerptReveal,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            &ldquo;{videoCopy?.pullQuote ?? excerpt}&rdquo;
          </div>
        </Sequence>

        {/* Author + Date */}
        <Sequence from={90}>
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transform: `translateY(${interpolate(authorReveal, [0, 1], [20, 0])}px)`,
              opacity: authorReveal,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: COLORS.accent,
                  ...borderBrutal,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: fonts.mono,
                  fontWeight: 800,
                  fontSize: 18,
                  color: '#FFFFFF',
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{...label(12), color: COLORS.muted}}>By</div>
                <div style={{...headline(16)}}>{authorName}</div>
              </div>
            </div>
            <div style={{...body(14), color: COLORS.muted}}>{formattedDate}</div>
          </div>
        </Sequence>

        {/* CTA */}
        <Sequence from={110}>
          <div
            style={{
              padding: '14px 24px',
              backgroundColor: COLORS.foreground,
              ...borderBrutal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transform: `translateY(${interpolate(ctaReveal, [0, 1], [30, 0])}px)`,
              opacity: ctaReveal,
            }}
          >
            <div
              style={{
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 14,
                color: COLORS.background,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {videoCopy?.ctaPrimary ?? 'Read more'}
            </div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 24,
                color: COLORS.accent,
              }}
            >
              &rarr;
            </div>
          </div>
        </Sequence>
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
