import React, {useMemo} from 'react'
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion'
import {COLORS, type ArticleVideoProps} from '../types'
import {PROMO_TIMELINE as T} from '../timeline'
import {
  EASE,
  MaskedLine,
  atFps,
  fitMonoLines,
  fitProseSize,
  formatShortDate,
  mix,
  tween,
} from '../motion'
import {Lockup, lockupTransform} from './brand'
// Side-effect import: runs loadFont() so the families behind the Tailwind
// `font-mono` / `font-serif` / `font-sans` utilities are available at render.
import '../fonts'

// Square promo card (1080×1080). Choreography lives in PROMO_TIMELINE:
// the brand ident fills the frame, collapses upward into the header bar, the
// card builds underneath it, holds, and the header drops back down to the
// ident — so the last frame matches the first and the video loops cleanly.

const MARGIN = 64
const HEADER_H = 88
const CONTENT_W = 1080 - MARGIN * 2
const TRACKING = -0.02
const WORD_SPACING = -0.2

export const ArticlePromo: React.FC<ArticleVideoProps> = ({
  title,
  authorName,
  publishedAt,
  excerpt,
  mainImageUrl,
  videoCopy,
}) => {
  const frame = useCurrentFrame()
  const {fps, durationInFrames, width, height} = useVideoConfig()
  const f = atFps(fps)

  const hasImage = Boolean(mainImageUrl)
  const headline = (videoCopy?.headline ?? title).toUpperCase()
  const quote = (videoCopy?.pullQuote ?? excerpt ?? '').trim()
  const kicker = videoCopy?.kicker ?? 'New Article'
  const date = formatShortDate(publishedAt)

  // With an image the headline shares the card; without one it IS the card.
  const fitted = useMemo(
    () =>
      fitMonoLines(
        headline,
        hasImage
          ? {maxWidth: CONTENT_W, maxHeight: 236, maxLines: 3, minSize: 44, maxSize: 88, tracking: TRACKING, wordSpacing: WORD_SPACING}
          : {maxWidth: CONTENT_W, maxHeight: 470, maxLines: 5, minSize: 52, maxSize: 168, tracking: TRACKING, wordSpacing: WORD_SPACING},
      ),
    [headline, hasImage],
  )
  const quoteSize = fitProseSize(quote, {
    maxWidth: CONTENT_W - 28,
    maxLines: hasImage ? 2 : 4,
    sizes: hasImage ? [34, 30, 27] : [46, 40, 34],
  })

  // ----- Curtain: 0 = full-frame ident, 1 = collapsed into the header --------
  const closeStart = durationInFrames - f(T.curtainClose.before)
  const closing = tween(frame, closeStart, f(T.curtainClose.for), EASE.inOut)
  const open = tween(frame, f(T.curtainOpen.at), f(T.curtainOpen.for), EASE.inOut) - closing
  const curtainHeight = mix(open, height, HEADER_H)
  const chrome = tween(open, 0.7, 0.3, EASE.soft) // header label + bottom rule

  // ----- Build ---------------------------------------------------------------
  const imageWipe = tween(frame, f(T.image.at), f(T.image.for), EASE.inOut)
  const imageLift = tween(frame, f(T.image.at + 16), f(18))
  const kickerPop = tween(frame, f(T.kicker.at), f(T.kicker.for), EASE.back)
  const quoteRule = tween(frame, f(T.quote.at), f(14), EASE.inOut)
  const quoteIn = tween(frame, f(T.quote.at + 4), f(T.quote.for))
  const authorIn = tween(frame, f(T.author.at), f(T.author.for))
  const avatarPop = tween(frame, f(T.author.at + 3), f(16), EASE.back)
  const ctaWipe = tween(frame, f(T.cta.at), f(T.cta.for), EASE.inOut)
  const ctaLabel = tween(frame, f(T.cta.at + 10), f(18))
  const arrowIn = tween(frame, f(T.cta.at + 14), f(18))

  // Idle life once the card has landed: the arrow nudges on a slow pulse.
  const idle = Math.max(0, frame - f(T.cta.at + 40))
  const pulse = (idle % f(48)) / f(48)
  const nudge = pulse < 0.5 ? Math.sin(pulse * 2 * Math.PI) * 10 : 0

  const kickerTag = (
    <div
      className="border-4 border-foreground bg-highlight px-5 py-2.5 font-mono text-[25px] leading-none font-extrabold tracking-[0.08em] whitespace-nowrap text-foreground uppercase shadow-[5px_5px_0_var(--color-foreground)]"
      style={{
        opacity: Math.min(1, kickerPop * 3),
        transform: `rotate(${mix(kickerPop, -10, -2)}deg) scale(${kickerPop})`,
        transformOrigin: 'left center',
      }}
    >
      {kicker}
    </div>
  )

  return (
    <AbsoluteFill className="overflow-hidden bg-background font-sans">
      {/* Paper grid */}
      <AbsoluteFill
        style={{
          opacity: 0.045,
          backgroundImage:
            'linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)',
          backgroundSize: '54px 54px',
        }}
      />

      {/* Card content — sinks slightly as the curtain comes back down */}
      <div
        className="absolute flex flex-col"
        style={{
          left: MARGIN,
          right: MARGIN,
          top: HEADER_H + 44,
          bottom: 56,
          transform: `translateY(${closing * 48}px)`,
        }}
      >
        {/* Image: wiped in left→right, then lifted onto its hard shadow */}
        {mainImageUrl ? (
          <div className="relative mb-12 min-h-0 flex-1">
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(-24px calc(${(1 - imageWipe) * 100}% - ${imageWipe * 24}px) -24px -24px)`,
              }}
            >
              <div
                className="size-full overflow-hidden border-4 border-foreground bg-foreground"
                style={{
                  boxShadow: `${imageLift * 10}px ${imageLift * 10}px 0 ${COLORS.foreground}`,
                  transform: `translate(${-imageLift * 4}px, ${-imageLift * 4}px)`,
                }}
              >
                <Img
                  src={mainImageUrl}
                  className="size-full object-cover"
                  style={{
                    transform: `scale(${1.08 + 0.2 * (1 - imageWipe) + (0.06 * frame) / durationInFrames})`,
                  }}
                />
              </div>
            </div>
            <div className="absolute -bottom-6 left-6">{kickerTag}</div>
          </div>
        ) : (
          <div className="mb-7 self-start">{kickerTag}</div>
        )}

        {/* Headline: fitted to the card, revealed line by line */}
        <div
          className="font-mono font-extrabold text-foreground"
          style={{
            fontSize: fitted.fontSize,
            lineHeight: fitted.lineHeight,
            letterSpacing: `${TRACKING}em`,
            wordSpacing: `${WORD_SPACING}em`,
          }}
        >
          {fitted.lines.map((line, i) => (
            <MaskedLine
              key={i}
              progress={tween(frame, f(T.title.at + i * T.titleStagger), f(T.title.for))}
            >
              {line}
            </MaskedLine>
          ))}
        </div>

        {/* Pull quote */}
        {quote ? (
          <div className={`relative pl-7 ${hasImage ? 'mt-6' : 'my-auto'}`}>
            <div
              className="absolute inset-y-1 left-0 w-1.5 bg-accent"
              style={{transform: `scaleY(${quoteRule})`, transformOrigin: 'top'}}
            />
            <div
              className={`font-serif leading-[1.28] text-foreground/70 italic ${
                hasImage ? 'line-clamp-2' : 'line-clamp-4'
              }`}
              style={{
                fontSize: quoteSize,
                opacity: quoteIn,
                transform: `translateY(${(1 - quoteIn) * 18}px)`,
              }}
            >
              &ldquo;{quote}&rdquo;
            </div>
          </div>
        ) : null}

        {/* Byline */}
        <div
          className="mt-auto flex items-center justify-between pt-6"
          style={{opacity: authorIn, transform: `translateY(${(1 - authorIn) * 20}px)`}}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex size-15 items-center justify-center border-4 border-foreground bg-accent font-mono text-[28px] leading-none font-extrabold text-white"
              style={{transform: `scale(${mix(avatarPop, 0.5, 1)})`}}
            >
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-mono text-[16px] leading-none font-bold tracking-[0.2em] text-muted uppercase">
                By
              </div>
              <div className="mt-2 font-mono text-[28px] leading-none font-extrabold tracking-[-0.02em] text-foreground uppercase">
                {authorName}
              </div>
            </div>
          </div>
          <div className="font-mono text-[20px] font-bold tracking-[0.12em] text-muted">{date}</div>
        </div>

        {/* CTA: bar wipes in, label and arrow follow */}
        <div
          className="mt-5 flex h-21 items-center justify-between bg-foreground px-7"
          style={{clipPath: `inset(0 ${(1 - ctaWipe) * 100}% 0 0)`}}
        >
          <div
            className="font-mono text-[24px] font-extrabold tracking-[0.1em] text-background uppercase"
            style={{opacity: ctaLabel, transform: `translateX(${(1 - ctaLabel) * -18}px)`}}
          >
            {videoCopy?.ctaPrimary ?? 'Read more'}
          </div>
          <div
            className="font-mono text-[38px] leading-none font-bold text-highlight"
            style={{
              opacity: arrowIn,
              transform: `translateX(${(1 - arrowIn) * -28 + nudge}px)`,
            }}
          >
            &rarr;
          </div>
        </div>
      </div>

      {/* Bottom rule draws in as the curtain clears */}
      <div
        className="absolute inset-x-0 bottom-0 h-2 bg-accent"
        style={{transform: `scaleX(${chrome})`, transformOrigin: 'left'}}
      />

      {/* Curtain / header: one dark panel that is the ident AND the header bar */}
      <div className="absolute inset-x-0 top-0 overflow-hidden bg-foreground" style={{height: curtainHeight}}>
        <Lockup
          fontSize={150}
          color={COLORS.background}
          markColor={COLORS.highlight}
          transform={lockupTransform(open, {
            frameWidth: width,
            frameHeight: height,
            identSize: 150,
            restSize: 30,
            restX: MARGIN,
            restY: (HEADER_H - 30) / 2,
          })}
        />
        <div
          className="absolute top-0 flex items-center font-mono text-[18px] font-bold tracking-[0.2em] text-highlight uppercase"
          style={{right: MARGIN, height: HEADER_H, opacity: chrome}}
        >
          Article
        </div>
      </div>
    </AbsoluteFill>
  )
}
