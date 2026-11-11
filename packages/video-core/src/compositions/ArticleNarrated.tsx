import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {COLORS, type ArticleNarratedChunk, type ArticleNarratedProps} from '../types'
import {NARRATED_TIMELINE as T} from '../timeline'
import {EASE, atFps, blockReveal, mix, tween} from '../motion'
import '../fonts'

// Long-form narrated reading, "documentary + b-roll" treatment. The spoken
// words live in a real closed-caption track on the consuming surfaces (site
// <video>, YouTube) — NOT burned into pixels — so the frame is free to be
// cinematic: full-bleed imagery cross-dissolving through the post's body
// images (falling back to the main image), with broadcast chrome (progress
// bar with chapter ticks, brand lockup), chapter cards on the H2 boundaries,
// and intro/outro cards. Each chunk's MP3 still plays in its own <Sequence>
// for exact audio timing; the total duration is computed by
// `calculateMetadata` (registry.ts). Beat lengths live in NARRATED_TIMELINE.
//
// Narration starts on frame 0, so the intro and outro cards are overlays on
// the timeline, never padding around it — caption timings depend on that.

const DEFAULT_BRAND = 'The Template'
const INK = '#0c0c0c'

// Element types derived from the props contract so they never drift from the schema.
type Chapter = NonNullable<ArticleNarratedProps['chapters']>[number]
type SceneImage = NonNullable<ArticleNarratedProps['images']>[number]
type TimedChunk = ArticleNarratedChunk & {startFrame: number; endFrame: number}
type Scene = {url: string; startFrame: number; endFrame: number; index: number}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return ''
  }
}

/**
 * Turn the main image + body images into an ordered, gap-free list of b-roll
 * scenes on the chunk timeline. Each body image starts when narration crosses
 * past the paragraph it followed; the main image opens the video. A scene runs
 * until the next one begins (or the end). Collapsed/overlapping anchors are
 * dropped so we never render a zero-length flash.
 */
function buildScenes(
  timedChunks: TimedChunk[],
  images: SceneImage[] | undefined,
  mainImageUrl: string | undefined,
  totalFrames: number,
): Scene[] {
  const chunkStart = (i: number) => timedChunks[i]?.startFrame ?? (i <= 0 ? 0 : totalFrames)

  const anchors: {url: string; startFrame: number}[] = []
  if (mainImageUrl) anchors.push({url: mainImageUrl, startFrame: 0})
  for (const img of images ?? []) {
    const startFrame = img.afterChunkIndex < 0 ? 0 : chunkStart(img.afterChunkIndex + 1)
    anchors.push({url: img.url, startFrame})
  }
  if (anchors.length === 0) return []

  anchors.sort((a, b) => a.startFrame - b.startFrame)
  // No hero image? Pull the earliest body image up to the opening so we never
  // open on a black frame.
  if (!mainImageUrl) anchors[0] = {...anchors[0], startFrame: 0}

  const scenes: Scene[] = []
  for (let i = 0; i < anchors.length; i++) {
    const startFrame = anchors[i].startFrame
    const endFrame = i + 1 < anchors.length ? anchors[i + 1].startFrame : totalFrames
    if (endFrame - startFrame < 1) continue // collided with the next anchor — drop
    scenes.push({url: anchors[i].url, startFrame, endFrame, index: scenes.length})
  }
  return scenes
}

// Full-bleed cross-dissolving image stage with a slow per-scene Ken Burns move.
// Scenes alternate push-in / pull-back so consecutive shots never drift the
// same way. Each dissolve is centred on the scene boundary; a scene mounts
// just before its dissolve and unmounts once the next one fully covers it, so
// a long reading only ever composites one or two images per frame.
function BRollStage({scenes}: {scenes: Scene[]}) {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const fade = atFps(fps)(T.sceneFade)

  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      {scenes.map((scene, i) => {
        const next = scenes[i + 1]
        if (frame < scene.startFrame - fade) return null
        if (next && frame >= next.startFrame + fade) return null

        const opacity =
          scene.index === 0 ? 1 : tween(frame, scene.startFrame - fade, fade * 2, EASE.soft)

        // The move spans the dissolves on both sides, so a shot is already
        // travelling as it fades up and still travelling as it fades away.
        const progress = interpolate(
          frame,
          [scene.startFrame - fade, scene.endFrame + fade],
          [0, 1],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )
        const pushIn = scene.index % 2 === 0
        const zoom = pushIn ? mix(progress, 1.06, 1.15) : mix(progress, 1.15, 1.06)
        const panX = mix(progress, pushIn ? -0.8 : 0.8, pushIn ? 0.8 : -0.8)
        const originY = pushIn ? '36%' : '62%'

        return (
          <Img
            key={`${scene.index}-${scene.url}`}
            src={scene.url}
            className="absolute inset-0 size-full object-cover"
            style={{
              opacity,
              transform: `scale(${zoom}) translateX(${panX}%)`,
              transformOrigin: `center ${originY}`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

// Persistent gradient scrim: darkens the top (for the progress bar + brand
// lockup) and the bottom (for chapter cards) while leaving the middle clear so
// the imagery reads.
function Scrim() {
  return (
    <AbsoluteFill className="bg-[linear-gradient(to_bottom,rgba(12,12,12,0.62)_0%,rgba(12,12,12,0.16)_20%,transparent_40%,transparent_52%,rgba(12,12,12,0.5)_78%,rgba(12,12,12,0.85)_100%)]" />
  )
}

// Thin broadcast progress bar across the very top — fills 0→100% across the
// whole reading so viewers can gauge how much is left, with a tick at each
// chapter. Rendered last so it stays visible over the intro/outro cards.
function ProgressBar({chapters, timedChunks}: {chapters: Chapter[]; timedChunks: TimedChunk[]}) {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const last = Math.max(1, durationInFrames - 1)
  const pct = interpolate(frame, [0, last], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div className="absolute inset-x-0 top-0 h-[5px] bg-white/15">
      <div className="h-full" style={{width: `${pct}%`, backgroundColor: COLORS.highlight}} />
      {chapters.map((chapter, i) => {
        const start = timedChunks[chapter.chunkIndex]?.startFrame
        if (!start) return null
        return (
          <span
            key={`${chapter.chunkIndex}-${i}`}
            className="absolute top-0 h-[9px] w-[2px]"
            style={{left: `${(start / last) * 100}%`, backgroundColor: INK}}
          />
        )
      })}
    </div>
  )
}

// Persistent top-left brand lockup + byline. Slides in as the intro card
// clears so the two don't overlap, and is held back during the outro by the
// outro scrim sitting above it.
function BrandLockup({brandName, authorName}: {brandName: string; authorName: string}) {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const f = atFps(fps)
  const enter = tween(frame, f(T.intro - 8), f(22))

  return (
    <div
      className="absolute top-9 left-16 flex items-center gap-3"
      style={{opacity: enter, transform: `translateX(${(1 - enter) * -16}px)`}}
    >
      <span className="size-3" style={{backgroundColor: COLORS.highlight}} />
      <span className="text-[22px] font-bold tracking-[-0.01em] text-white">{brandName}</span>
      <span className="text-[20px] text-white/40">·</span>
      <span className="text-[20px] text-white/70">by {authorName}</span>
    </div>
  )
}

// Chapter cards: one per H2/H3 heading, a lower third that opens at the
// heading's narration chunk, numbered in document order. Sits above the band
// where players draw closed captions. A card yields early if the next chapter
// arrives before its hold is up.
function ChapterCards({chapters, timedChunks}: {chapters: Chapter[]; timedChunks: TimedChunk[]}) {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()
  const f = atFps(fps)
  const exitFrames = f(14)
  const outroStart = durationInFrames - f(T.outro)

  return (
    <>
      {chapters.map((chapter, i) => {
        const tc = timedChunks[chapter.chunkIndex]
        if (!tc) return null

        // A chapter that opens inside the intro waits for the title card to clear.
        const start = Math.max(tc.startFrame, f(T.intro))
        const nextStart = chapters
          .slice(i + 1)
          .map((c) => timedChunks[c.chunkIndex]?.startFrame)
          .find((s): s is number => s !== undefined && s > start)
        const end = Math.min(start + f(T.chapterCard), nextStart ?? Infinity, outroStart)
        if (frame < start || frame >= end) return null

        const rule = tween(frame, start, f(14), EASE.inOut)
        const label = tween(frame, start + f(5), f(16))
        const heading = tween(frame, start + f(8), f(22))
        const exit = tween(frame, end - exitFrames, exitFrames, EASE.in)

        return (
          <div
            key={`${chapter.chunkIndex}-${i}`}
            className="absolute bottom-[124px] left-16 max-w-[70%] pl-6"
            style={{opacity: 1 - exit, transform: `translateX(${exit * -20}px)`}}
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{
                backgroundColor: COLORS.highlight,
                transform: `scaleY(${rule})`,
                transformOrigin: 'top',
              }}
            />
            <p
              className="m-0 mb-2.5 font-mono text-[15px] leading-none font-bold tracking-[0.24em] uppercase"
              style={{
                color: COLORS.highlight,
                opacity: label,
                transform: `translateX(${(1 - label) * -12}px)`,
              }}
            >
              Chapter {String(i + 1).padStart(2, '0')}
            </p>
            <p
              className="m-0 line-clamp-2 text-[38px] leading-[1.12] font-bold tracking-[-0.02em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]"
              style={blockReveal(heading, 20)}
            >
              {chapter.title}
            </p>
          </div>
        )
      })}
    </>
  )
}

// Intro title card over the opening b-roll: kicker, headline, rule, byline —
// staggered in, held, then lifted away as the b-roll takes over. The scrim is
// already down on frame 0 so the video never opens on a bare image.
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
  const {fps} = useVideoConfig()
  const f = atFps(fps)
  if (frame >= f(T.intro)) return null

  const exit = tween(frame, f(T.intro - T.introExit), f(T.introExit), EASE.in)
  const kickerIn = tween(frame, f(2), f(18))
  const titleIn = tween(frame, f(5), f(26))
  const rule = tween(frame, f(16), f(22), EASE.inOut)
  const bylineIn = tween(frame, f(22), f(20))
  const date = formatDate(publishedAt)

  return (
    <AbsoluteFill
      className="flex flex-col items-start justify-center bg-[linear-gradient(to_right,rgba(12,12,12,0.78),rgba(12,12,12,0.4))] px-24"
      style={{opacity: 1 - exit}}
    >
      <div className="max-w-[80%]" style={{transform: `translateY(${exit * -24}px)`}}>
        {kicker ? (
          <p
            className="m-0 mb-6 flex items-center gap-4 font-mono text-[19px] leading-none font-bold tracking-[0.24em] uppercase"
            style={{
              color: COLORS.highlight,
              opacity: kickerIn,
              transform: `translateX(${(1 - kickerIn) * -16}px)`,
            }}
          >
            <span className="h-[3px] w-10" style={{backgroundColor: COLORS.highlight}} />
            {kicker}
          </p>
        ) : null}
        <h1
          className="m-0 line-clamp-3 text-[72px] leading-[1.05] font-bold tracking-[-0.03em] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.6)]"
          style={blockReveal(titleIn, 36)}
        >
          {title}
        </h1>
        <div
          className="mt-8 mb-6 h-[3px] w-28"
          style={{
            backgroundColor: COLORS.highlight,
            transform: `scaleX(${rule})`,
            transformOrigin: 'left',
          }}
        />
        <p
          className="m-0 text-[23px] text-white/80"
          style={{opacity: bylineIn, transform: `translateY(${(1 - bylineIn) * 12}px)`}}
        >
          <span className="font-bold text-white">{authorName}</span>
          {date ? <span className="text-white/60">{`  ·  ${date}`}</span> : null}
        </p>
      </div>
    </AbsoluteFill>
  )
}

// Outro brand card over the closing b-roll, anchored to the end of the
// timeline. This composition IS the full article read aloud, so there's no
// "read more" CTA — the reading resolves on the brand wordmark with the
// article title as a sign-off, and <FadeToBlack> closes the video.
function OutroCard({brandName, title}: {brandName: string; title: string}) {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()
  const f = atFps(fps)
  const start = durationInFrames - f(T.outro)
  // Too short to hold both cards (e.g. a one-line post): skip the outro.
  if (start < f(T.intro) || frame < start) return null

  const scrim = tween(frame, start, f(24), EASE.soft)
  const mark = tween(frame, start + f(8), f(18), EASE.back)
  const wordmark = tween(frame, start + f(12), f(26))
  const rule = tween(frame, start + f(22), f(22), EASE.inOut)
  const signOff = tween(frame, start + f(30), f(22))

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center bg-[rgba(12,12,12,0.72)]"
      style={{opacity: scrim}}
    >
        <span
          className="mb-8 size-5"
          style={{backgroundColor: COLORS.highlight, transform: `scale(${mark})`}}
        />
        <p
          className="m-0 text-[64px] leading-[1.1] font-bold tracking-[-0.03em] text-white"
          style={blockReveal(wordmark, 30)}
        >
          {brandName}
        </p>
        <div
          className="mt-7 mb-6 h-[3px] w-28"
          style={{backgroundColor: COLORS.highlight, transform: `scaleX(${rule})`}}
        />
        <p
          className="m-0 line-clamp-1 max-w-[70%] text-center font-serif text-[30px] text-white/75 italic"
          style={{opacity: signOff, transform: `translateY(${(1 - signOff) * 12}px)`}}
        >
          {title}
        </p>
    </AbsoluteFill>
  )
}

// Final fade to black over everything (chrome included), landing on the last
// frame. Skipped with the outro on readings too short to hold one.
function FadeToBlack() {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()
  const f = atFps(fps)
  if (durationInFrames - f(T.outro) < f(T.intro)) return null
  const opacity = tween(frame, durationInFrames - f(T.fadeOut), f(T.fadeOut) - 1, EASE.soft)
  if (opacity <= 0) return null
  return <AbsoluteFill style={{backgroundColor: '#000', opacity}} />
}

export const ArticleNarrated: React.FC<ArticleNarratedProps> = ({
  title,
  authorName,
  publishedAt,
  mainImageUrl,
  chunks,
  brandName,
  kicker,
  chapters,
  images,
}) => {
  const {fps, durationInFrames} = useVideoConfig()
  const brand = brandName?.trim() || DEFAULT_BRAND

  // Walk the chunks once, computing each chunk's absolute start/end frame so the
  // b-roll, chapter cards and audio sequences all share one timeline.
  let frameOffset = 0
  const timedChunks: TimedChunk[] = chunks.map((chunk) => {
    const chunkFrames = Math.max(1, Math.ceil(chunk.durationSeconds * fps))
    const startFrame = frameOffset
    const endFrame = frameOffset + chunkFrames
    frameOffset = endFrame
    return {...chunk, startFrame, endFrame}
  })

  const scenes = buildScenes(timedChunks, images, mainImageUrl, durationInFrames)

  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      <BRollStage scenes={scenes} />

      <Scrim />

      <ChapterCards chapters={chapters ?? []} timedChunks={timedChunks} />

      <BrandLockup brandName={brand} authorName={authorName} />

      <IntroCard kicker={kicker} title={title} authorName={authorName} publishedAt={publishedAt} />

      <OutroCard brandName={brand} title={title} />

      <ProgressBar chapters={chapters ?? []} timedChunks={timedChunks} />

      <FadeToBlack />

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
