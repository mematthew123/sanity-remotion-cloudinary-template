import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {COLORS, type ArticleNarratedChunk, type ArticleNarratedProps} from '../types'
import '../fonts'

// Editorial-broadcast chrome: a top progress bar, a persistent brand lockup, an
// intro title card and an outro CTA card frame the reading without touching the
// audio timeline. Intro/outro are pure OVERLAYS over the first/last frames —
// the chunk <Sequence> audio and the computed `calculateMetadata` duration are
// untouched, so timing stays exact and nothing needs re-summing.
const INTRO_FRAMES = 75 // ~2.5s @ 30fps
const OUTRO_FRAMES = 90 // ~3s @ 30fps
const DEFAULT_BRAND = 'The Template'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
  } catch {
    return ''
  }
}

// Long-form narrated reading. Each chunk is one paragraph: its MP3 plays in a
// dedicated <Sequence> for exact audio timing. The background image, blurred
// wash, Ken-Burns pan, and bottom scrim are rendered ONCE at the root so they
// stay continuous across the entire video — only the caption text crossfades
// at paragraph boundaries. The composition's total duration is set via
// `calculateMetadata` (see registry.ts) from the sum of chunk durations.

/**
 * Bucket caption font size by character length so long paragraphs don't
 * overflow the lower-third box. Pairs with the `lineClamp`/maxHeight safety
 * net in the JSX below — text is always sized to fit, and the safety net
 * catches edge cases where even the smallest bucket would spill.
 */
function captionStyle(textLength: number): {fontSize: number; lineHeight: number; maxLines: number} {
  if (textLength < 120) return {fontSize: 56, lineHeight: 1.25, maxLines: 4}
  if (textLength < 240) return {fontSize: 44, lineHeight: 1.3, maxLines: 5}
  if (textLength < 400) return {fontSize: 36, lineHeight: 1.35, maxLines: 6}
  return {fontSize: 30, lineHeight: 1.4, maxLines: 7}
}

type TimedChunk = ArticleNarratedChunk & {startFrame: number; endFrame: number}

function ContinuousBackground({mainImageUrl}: {mainImageUrl?: string}) {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()

  // One slow zoom across the entire video — no per-scene resets.
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill className="bg-[#0c0c0c]">
      {mainImageUrl ? (
        <>
          <Img
            src={mainImageUrl}
            className="size-full scale-[1.2] object-cover opacity-60 blur-[48px] saturate-[1.1]"
          />
          <AbsoluteFill className="items-start justify-start p-0">
            <Img
              src={mainImageUrl}
              className="h-[68%] w-full origin-[center_35%] object-cover"
              style={{transform: `scale(${zoom})`}}
            />
          </AbsoluteFill>
        </>
      ) : null}
      <AbsoluteFill className="bg-[linear-gradient(to_bottom,transparent_0%,transparent_55%,rgba(12,12,12,0.78)_75%,rgba(12,12,12,0.92)_100%)]" />
    </AbsoluteFill>
  )
}

// Caption crossfade duration — short enough that the swap feels snappy, long
// enough that the eye registers the transition rather than a jump cut.
const CAPTION_FADE_FRAMES = 10

function CaptionTrack({chunks}: {chunks: TimedChunk[]}) {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill className="flex items-end justify-center px-30 pt-0 pb-20">
      {chunks.map((chunk) => {
        // Overlapping ramps: a caption begins fading IN before the previous
        // one finishes fading OUT, producing a true crossfade with no blank
        // gap. The fade is anchored to scene boundaries so audio timing
        // (hard cuts in the Sequence layer above) stays exact.
        const opacity = interpolate(
          frame,
          [
            chunk.startFrame - CAPTION_FADE_FRAMES,
            chunk.startFrame + CAPTION_FADE_FRAMES,
            chunk.endFrame - CAPTION_FADE_FRAMES,
            chunk.endFrame + CAPTION_FADE_FRAMES,
          ],
          [0, 1, 1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )

        if (opacity <= 0) return null

        const cap = captionStyle(chunk.text.length)

        return (
          <p
            key={chunk.id}
            className="absolute bottom-20 left-1/2 m-0 [display:-webkit-box] w-[calc(100%-240px)] max-w-360 -translate-x-1/2 overflow-hidden text-center font-medium tracking-[-0.005em] text-white [-webkit-box-orient:vertical] [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]"
            style={{
              fontSize: cap.fontSize,
              lineHeight: cap.lineHeight,
              WebkitLineClamp: cap.maxLines,
              opacity,
            }}
          >
            {chunk.text}
          </p>
        )
      })}
    </AbsoluteFill>
  )
}

// Thin broadcast progress bar across the very top — fills 0→100% across the
// whole reading so viewers can gauge how much is left. Rendered last so it
// stays visible over the intro/outro cards.
function ProgressBar() {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const pct = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div className="absolute inset-x-0 top-0 h-[5px] bg-white/10">
      <div className="h-full" style={{width: `${pct}%`, backgroundColor: COLORS.accent}} />
    </div>
  )
}

// Persistent top-left brand lockup + byline. Fades in as the intro card clears
// so the two don't overlap, and is held back during the outro by the outro
// scrim sitting above it.
function BrandLockup({brandName, authorName}: {brandName: string; authorName: string}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [INTRO_FRAMES - 12, INTRO_FRAMES + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div className="absolute top-9 left-16 flex items-center gap-3" style={{opacity}}>
      <span className="size-3 rounded-full" style={{backgroundColor: COLORS.accent}} />
      <span className="text-[22px] font-semibold tracking-[-0.01em] text-white">{brandName}</span>
      <span className="text-[20px] text-white/40">·</span>
      <span className="text-[20px] font-medium text-white/70">by {authorName}</span>
    </div>
  )
}

// Intro title card over the first INTRO_FRAMES: kicker + headline + byline,
// fading out as the first paragraph caption emerges underneath.
function IntroCard({
  kicker,
  title,
  authorName,
  publishedAt,
}: {
  kicker?: string
  title: string
  authorName: string
  publishedAt: string
}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 8, INTRO_FRAMES - 16, INTRO_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null

  const rise = interpolate(frame, [0, 22], [26, 0], {extrapolateRight: 'clamp'})

  return (
    <AbsoluteFill
      className="flex flex-col items-start justify-center bg-black/45 px-24"
      style={{opacity}}
    >
      <div style={{transform: `translateY(${rise}px)`}} className="max-w-[80%]">
        {kicker ? (
          <p
            className="m-0 mb-5 text-[24px] font-semibold uppercase tracking-[0.22em]"
            style={{color: COLORS.accent}}
          >
            {kicker}
          </p>
        ) : null}
        <h1 className="m-0 text-[68px] font-bold leading-[1.06] tracking-[-0.02em] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.8)]">
          {title}
        </h1>
        <div className="mt-7 mb-5 h-px w-24" style={{backgroundColor: COLORS.accent}} />
        <p className="m-0 text-[22px] font-medium text-white/75">
          {authorName}
          {formatDate(publishedAt) ? `  ·  ${formatDate(publishedAt)}` : ''}
        </p>
      </div>
    </AbsoluteFill>
  )
}

// Outro CTA over the last OUTRO_FRAMES, anchored to the end of the timeline.
function OutroCard({brandName}: {brandName: string}) {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const start = durationInFrames - OUTRO_FRAMES
  const opacity = interpolate(frame, [start, start + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null

  const rise = interpolate(frame, [start, start + 22], [22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center bg-black/60" style={{opacity}}>
      <div style={{transform: `translateY(${rise}px)`}} className="flex flex-col items-center">
        <span
          className="mb-6 size-3.5 rounded-full"
          style={{backgroundColor: COLORS.accent}}
        />
        <p className="m-0 text-[52px] font-bold tracking-[-0.02em] text-white">Read the full article</p>
        <p className="mt-4 text-[24px] font-medium uppercase tracking-[0.18em] text-white/55">
          {brandName}
        </p>
      </div>
    </AbsoluteFill>
  )
}

export const ArticleNarrated: React.FC<ArticleNarratedProps> = ({
  title,
  authorName,
  publishedAt,
  mainImageUrl,
  chunks,
  brandName,
  kicker,
}) => {
  const {fps} = useVideoConfig()
  const brand = brandName?.trim() || DEFAULT_BRAND

  // Walk the chunks once, computing each chunk's absolute start/end frame so
  // the caption track and the audio sequences can share the same timeline.
  let frameOffset = 0
  const timedChunks: TimedChunk[] = chunks.map((chunk) => {
    const durationInFrames = Math.max(1, Math.ceil(chunk.durationSeconds * fps))
    const startFrame = frameOffset
    const endFrame = frameOffset + durationInFrames
    frameOffset = endFrame
    return {...chunk, startFrame, endFrame}
  })

  return (
    <AbsoluteFill className="bg-[#0c0c0c]">
      <ContinuousBackground mainImageUrl={mainImageUrl} />

      <CaptionTrack chunks={timedChunks} />

      <BrandLockup brandName={brand} authorName={authorName} />

      <IntroCard kicker={kicker} title={title} authorName={authorName} publishedAt={publishedAt} />

      <OutroCard brandName={brand} />

      <ProgressBar />

      {timedChunks.map((chunk) =>
        // Guard the empty-`audioUrl` demo/preview chunks — Remotion's <Audio>
        // throws on an empty src. Real renders always have a Cloudinary URL.
        chunk.audioUrl ? (
          <Sequence
            key={chunk.id}
            from={chunk.startFrame}
            durationInFrames={chunk.endFrame - chunk.startFrame}
          >
            <Audio src={chunk.audioUrl} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  )
}
