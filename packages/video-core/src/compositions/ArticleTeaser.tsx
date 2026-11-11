import React, {useMemo} from 'react'
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {COLORS, type ArticleVideoProps} from '../types'
import {TEASER_TIMELINE as T} from '../timeline'
import {EASE, MaskedLine, atFps, fitMonoLines, fitProseSize, mix, tween} from '../motion'
import {Lockup, lockupTransform} from './brand'
// Side-effect import: runs loadFont() so the families behind the Tailwind
// `font-mono` / `font-serif` / `font-sans` utilities are available at render.
import '../fonts'

// Vertical teaser (1080×1920) for stories / reels / shorts. Choreography lives
// in TEASER_TIMELINE: a highlight-yellow ident curtain lifts off the frame, the
// headline lands big, a stamp slams in (the one loud beat), then quote, byline
// and CTA — and the curtain returns so the loop is seamless.
//
// Everything sits inside the platform-safe area: the top ~170px and bottom
// ~320px are where story UIs draw their own chrome.

const SIDE = 80
const SAFE_TOP = 170
const SAFE_BOTTOM = 320
const CONTENT_W = 1080 - SIDE * 2
const TRACKING = -0.02
const WORD_SPACING = -0.2
const IDENT_SIZE = 170
const BRAND_SIZE = 38

export const ArticleTeaser: React.FC<ArticleVideoProps> = ({
  title,
  authorName,
  excerpt,
  videoCopy,
}) => {
  const frame = useCurrentFrame()
  const {fps, durationInFrames, width, height} = useVideoConfig()
  const f = atFps(fps)

  const headline = (videoCopy?.headline ?? title).toUpperCase()
  const quote = (videoCopy?.pullQuote ?? excerpt ?? '').trim()
  const words = quote ? `“${quote}”`.split(/\s+/) : []

  const fitted = useMemo(
    () =>
      fitMonoLines(headline, {
        maxWidth: CONTENT_W,
        maxHeight: 580,
        maxLines: 6,
        minSize: 60,
        maxSize: 176,
        tracking: TRACKING,
        wordSpacing: WORD_SPACING,
      }),
    [headline],
  )
  const quoteSize = fitProseSize(quote, {maxWidth: CONTENT_W, maxLines: 4, sizes: [64, 56, 50, 44, 38]})

  // ----- Curtain: 0 = full-frame ident, 1 = lifted clear ----------------------
  const closeStart = durationInFrames - f(T.curtainClose.before)
  const closing = tween(frame, closeStart, f(T.curtainClose.for), EASE.inOut)
  const open = tween(frame, f(T.curtainOpen.at), f(T.curtainOpen.for), EASE.inOut) - closing
  const lockup = lockupTransform(open, {
    frameWidth: width,
    frameHeight: height,
    identSize: IDENT_SIZE,
    restSize: BRAND_SIZE,
    restX: SIDE,
    restY: SAFE_TOP,
  })

  // ----- Build ---------------------------------------------------------------
  const kickerIn = tween(frame, f(T.kicker.at), f(T.kicker.for))
  // The swipe waits for the last headline line to be mostly up, however many
  // lines the headline wrapped to.
  const lastLineAt = T.title.at + (fitted.lines.length - 1) * T.titleStagger
  const highlight = tween(
    frame,
    f(Math.max(T.highlight.at, lastLineAt + 14)),
    f(T.highlight.for),
    EASE.inOut,
  )
  const authorIn = tween(frame, f(T.author.at), f(T.author.for))
  const ctaWipe = tween(frame, f(T.cta.at), f(T.cta.for), EASE.inOut)
  const ctaLabel = tween(frame, f(T.cta.at + 10), f(18))

  // ----- The stamp: accelerates in, lands, and the frame takes the hit --------
  const impact = f(T.stamp.at + T.stamp.for)
  const stampFly = tween(frame, f(T.stamp.at), f(T.stamp.for), EASE.in)
  const sinceImpact = frame - impact
  const recoil = sinceImpact >= 0 ? Math.sin(Math.PI * Math.min(1, sinceImpact / f(9))) * 0.07 : 0
  // A two-frame hit that is gone again in a sixth of a second — any longer and
  // it reads as a colour wash instead of an impact.
  const flash = interpolate(frame, [impact - 1, impact, impact + f(6)], [0, 0.34, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.out,
  })
  const shakeDecay = sinceImpact >= 0 && sinceImpact < f(12) ? (1 - sinceImpact / f(12)) ** 2 * 13 : 0
  const shakeX = shakeDecay * Math.sin(sinceImpact * 2.4)
  const shakeY = shakeDecay * Math.cos(sinceImpact * 3.1) * 0.6

  // Idle life once the CTA has landed.
  const idle = Math.max(0, frame - f(T.cta.at + 36))
  const pulse = (idle % f(44)) / f(44)
  const nudge = pulse < 0.5 ? Math.sin(pulse * 2 * Math.PI) * 12 : 0

  // Word-by-word quote, paced so long quotes don't run past the byline.
  const wordStagger = Math.min(2.2, f(30) / Math.max(1, words.length))

  return (
    <AbsoluteFill className="overflow-hidden bg-foreground font-mono">
      {/* Diagonal rules, drifting slowly so the hold never feels frozen */}
      <AbsoluteFill className="opacity-[0.06]">
        <div className="absolute inset-0" style={{transform: `translateX(${-((frame * 0.5) % 80)}px)`}}>
          {Array.from({length: 22}).map((_, i) => (
            <div
              key={i}
              className="absolute -top-50 h-650 w-0.5 rotate-30 bg-highlight"
              style={{left: i * 80 - 200}}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* Impact flash */}
      <AbsoluteFill className="bg-background" style={{opacity: flash}} />

      {/* Resting brand lockup (the light twin of the one inside the curtain) */}
      <Lockup
        fontSize={IDENT_SIZE}
        color={COLORS.background}
        markColor={COLORS.highlight}
        transform={lockup}
      />

      {/* Content column */}
      <div
        className="absolute flex flex-col"
        style={{
          left: SIDE,
          right: SIDE,
          top: SAFE_TOP + 104,
          bottom: SAFE_BOTTOM,
          transform: `translate(${shakeX}px, ${shakeY + closing * 60}px)`,
        }}
      >
        {/* Kicker */}
        <div
          className="mb-8 flex items-center gap-4 text-[28px] leading-none font-bold tracking-[0.22em] text-highlight uppercase"
          style={{opacity: kickerIn, transform: `translateX(${(1 - kickerIn) * -24}px)`}}
        >
          <span className="h-1 w-12 bg-highlight" />
          {videoCopy?.kicker ?? 'Article'}
        </div>

        {/* Headline: fitted to the frame, revealed line by line; the last line
            gets a highlighter swipe (a dark-on-yellow twin unmasked over it). */}
        <div
          className="font-extrabold text-background"
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
              style={{paddingInline: '0.12em', marginInline: '-0.12em'}}
            >
              <span className="relative inline-block">
                {line}
                {i === fitted.lines.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 bg-highlight text-foreground"
                    style={{
                      left: '-0.12em',
                      right: '-0.1em',
                      paddingLeft: '0.12em',
                      clipPath: `inset(0 ${(1 - highlight) * 100}% 0 0)`,
                    }}
                  >
                    {line}
                  </span>
                ) : null}
              </span>
            </MaskedLine>
          ))}
        </div>

        {/* Stamp */}
        <div
          className="mt-9 self-start border-4 border-background bg-accent px-6 py-3.5 text-[30px] leading-none font-extrabold tracking-[0.1em] text-white uppercase shadow-[7px_7px_0_var(--color-highlight)]"
          style={{
            opacity: Math.min(1, stampFly * 2.5),
            transform: `rotate(${mix(stampFly, -16, -3)}deg) scale(${mix(stampFly, 3.2, 1) - recoil})`,
            transformOrigin: 'left center',
          }}
        >
          New Article
        </div>

        {/* Pull quote, word by word */}
        {words.length > 0 ? (
          <div
            className="mt-14 line-clamp-4 font-serif leading-[1.22] text-background italic"
            style={{fontSize: quoteSize}}
          >
            {words.map((word, i) => {
              const p = tween(frame, f(T.quote.at) + i * wordStagger, f(T.quote.for))
              return (
                <span
                  key={i}
                  className="inline-block"
                  style={{opacity: p, transform: `translateY(${(1 - p) * 16}px)`, marginRight: '0.26em'}}
                >
                  {word}
                </span>
              )
            })}
          </div>
        ) : null}

        {/* Byline + CTA */}
        <div className="mt-auto">
          <div
            className="mb-7 text-[26px] leading-none font-bold tracking-[0.16em] text-background/60 uppercase"
            style={{opacity: authorIn, transform: `translateY(${(1 - authorIn) * 18}px)`}}
          >
            By <span className="text-background">{authorName}</span>
          </div>
          <div style={{clipPath: `inset(-12px ${(1 - ctaWipe) * 100}% -12px -12px)`}}>
            <div className="mr-2 mb-2 flex h-28 items-center justify-between bg-highlight px-9 shadow-[8px_8px_0_var(--color-accent)]">
              <div
                className="text-[34px] leading-none font-extrabold tracking-[0.08em] text-foreground uppercase"
                style={{opacity: ctaLabel, transform: `translateX(${(1 - ctaLabel) * -20}px)`}}
              >
                {videoCopy?.ctaPrimary ?? 'Read more'}
              </div>
              <div
                className="text-[48px] leading-none font-bold text-foreground"
                style={{opacity: ctaLabel, transform: `translateX(${(1 - ctaLabel) * -30 + nudge}px)`}}
              >
                &rarr;
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress rule along the bottom edge */}
      <div
        className="absolute inset-x-0 bottom-0 h-2.5 bg-accent"
        style={{
          transform: `scaleX(${interpolate(frame, [0, closeStart], [0, 1], {extrapolateRight: 'clamp'})})`,
          transformOrigin: 'left',
        }}
      />

      {/* Ident curtain, lifting off the top; its lockup is the dark twin, so the
          wordmark appears to invert as the curtain's edge passes through it */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden bg-highlight"
        style={{height: mix(open, height, 0)}}
      >
        <Lockup
          fontSize={IDENT_SIZE}
          color={COLORS.foreground}
          markColor={COLORS.accent}
          transform={lockup}
        />
      </div>
    </AbsoluteFill>
  )
}
