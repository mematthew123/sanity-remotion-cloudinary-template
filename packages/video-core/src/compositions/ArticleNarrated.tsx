import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {COLORS, type ArticleNarratedChunk, type ArticleNarratedProps} from '../types'
import '../fonts'

// Long-form narrated reading, "documentary + b-roll" treatment. The spoken
// words live in a real closed-caption track on the consuming surfaces (site
// <video>, YouTube) — NOT burned into pixels — so the frame is free to be
// cinematic: full-bleed imagery cross-dissolving through the post's body
// images (falling back to the main image), with broadcast chrome (progress
// bar, brand lockup), chapter cards on the H2 boundaries, and intro/outro
// cards. Each chunk's MP3 still plays in its own <Sequence> for exact audio
// timing; the total duration is computed by `calculateMetadata` (registry.ts).

const INTRO_FRAMES = 75 // ~2.5s @ 30fps
const OUTRO_FRAMES = 90 // ~3s @ 30fps
const SCENE_FADE_FRAMES = 18 // b-roll cross-dissolve
const CHAPTER_CARD_FRAMES = 80 // how long a chapter card holds
const CHAPTER_FADE_FRAMES = 12
const DEFAULT_BRAND = 'The Template'

// Element types derived from the props contract so they never drift from the schema.
type Chapter = NonNullable<ArticleNarratedProps['chapters']>[number]
type SceneImage = NonNullable<ArticleNarratedProps['images']>[number]
type TimedChunk = ArticleNarratedChunk & {startFrame: number; endFrame: number}
type Scene = {url: string; startFrame: number; endFrame: number; index: number}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
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

// Full-bleed cross-dissolving image stage with a slow per-scene Ken-Burns zoom.
// Scenes stack in order and stay mounted once shown; the next scene fading in
// reveals over the previous, so only the trailing edge needs a ramp.
function BRollStage({scenes}: {scenes: Scene[]}) {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill className="bg-[#0c0c0c]">
      {scenes.map((scene) => {
        if (frame < scene.startFrame - SCENE_FADE_FRAMES) return null

        const opacity =
          scene.index === 0
            ? 1
            : interpolate(
                frame,
                [scene.startFrame - SCENE_FADE_FRAMES, scene.startFrame + SCENE_FADE_FRAMES],
                [0, 1],
                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
              )

        const progress = interpolate(frame, [scene.startFrame, scene.endFrame], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const zoom = 1.05 + 0.08 * progress
        const originY = scene.index % 2 === 0 ? '35%' : '62%'

        return (
          <Img
            key={`${scene.index}-${scene.url}`}
            src={scene.url}
            className="absolute inset-0 size-full object-cover"
            style={{opacity, transform: `scale(${zoom})`, transformOrigin: `center ${originY}`}}
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
    <AbsoluteFill className="bg-[linear-gradient(to_bottom,rgba(12,12,12,0.6)_0%,rgba(12,12,12,0.15)_20%,transparent_42%,transparent_60%,rgba(12,12,12,0.62)_86%,rgba(12,12,12,0.85)_100%)]" />
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

// Chapter cards: one per H2/H3 heading, appearing at the heading's narration
// chunk for a few seconds, numbered in document order.
function ChapterCards({chapters, timedChunks}: {chapters: Chapter[]; timedChunks: TimedChunk[]}) {
  const frame = useCurrentFrame()

  return (
    <>
      {chapters.map((chapter, i) => {
        const tc = timedChunks[chapter.chunkIndex]
        if (!tc) return null

        const start = tc.startFrame
        const end = start + CHAPTER_CARD_FRAMES
        const opacity = interpolate(
          frame,
          [start, start + CHAPTER_FADE_FRAMES, end - CHAPTER_FADE_FRAMES, end],
          [0, 1, 1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )
        if (opacity <= 0) return null

        const slide = interpolate(frame, [start, start + CHAPTER_FADE_FRAMES], [18, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })

        return (
          <div
            key={`${chapter.chunkIndex}-${i}`}
            className="absolute bottom-16 left-16 flex items-center gap-4"
            style={{opacity, transform: `translateY(${slide}px)`}}
          >
            <span className="h-px w-10" style={{backgroundColor: COLORS.accent}} />
            <span className="text-[22px] font-bold tabular-nums" style={{color: COLORS.accent}}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[30px] font-semibold tracking-[-0.01em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.85)]">
              {chapter.title}
            </span>
          </div>
        )
      })}
    </>
  )
}

// Intro title card over the first INTRO_FRAMES: kicker + headline + byline,
// fading out as the b-roll takes over underneath.
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

// Outro brand card over the last OUTRO_FRAMES, anchored to the end of the
// timeline. This composition IS the full article read aloud, so there's no
// "read more" CTA — the reading simply resolves on the brand wordmark.
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
        <span className="mb-7 size-4 rounded-full" style={{backgroundColor: COLORS.accent}} />
        <p className="m-0 text-[56px] font-bold tracking-[-0.02em] text-white">{brandName}</p>
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
    <AbsoluteFill className="bg-[#0c0c0c]">
      <BRollStage scenes={scenes} />

      <Scrim />

      <ChapterCards chapters={chapters ?? []} timedChunks={timedChunks} />

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
