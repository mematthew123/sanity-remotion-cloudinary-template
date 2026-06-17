import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import type {ArticleNarratedChunk, ArticleNarratedProps} from '../types'
import '../fonts'

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

export const ArticleNarrated: React.FC<ArticleNarratedProps> = ({mainImageUrl, chunks}) => {
  const {fps} = useVideoConfig()

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

      {timedChunks.map((chunk) => (
        <Sequence
          key={chunk.id}
          from={chunk.startFrame}
          durationInFrames={chunk.endFrame - chunk.startFrame}
        >
          <Audio src={chunk.audioUrl} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
