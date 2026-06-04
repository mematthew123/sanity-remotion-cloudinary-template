import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import type {ArticleNarratedChunk, ArticleNarratedProps} from '../types'
import '../fonts'

// Long-form narrated reading. Each chunk is one paragraph: its MP3 plays in a
// dedicated <Sequence>, with a Ken-Burns pan on the post's main image behind a
// lower-third caption of the spoken text. The composition's total duration is
// set via `calculateMetadata` (see registry.ts) from the sum of chunk
// durations, so the composition body is purely presentational.

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

function ChunkScene({chunk, mainImageUrl}: {chunk: ArticleNarratedChunk; mainImageUrl?: string}) {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()

  // Slow zoom Ken Burns: 1.0 → 1.06 across the scene. Subtle so the eye
  // isn't pulled away from the caption.
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Crossfade in/out: 18 frames (0.6s @ 30fps). Slightly longer than the
  // previous 15 frames so scene transitions feel more cinematic.
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'})
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(fadeIn, fadeOut)

  const cap = captionStyle(chunk.text.length)

  return (
    <AbsoluteFill className="bg-[#0c0c0c]" style={{opacity}}>
      {/* Blurred wash — fills the frame with the image's colors so there are
          no hard black bars, especially when the image is portrait-cropped
          inside a 16:9 frame. Cheap on the GPU; just CSS filter. */}
      {mainImageUrl ? (
        <Img
          src={mainImageUrl}
          className="h-full w-full scale-[1.2] object-cover opacity-60 blur-[48px] saturate-[1.1]"
        />
      ) : null}

      {/* Foreground image with Ken Burns — left-aligned and constrained to the
          upper two-thirds so it doesn't fight with the caption. */}
      {mainImageUrl ? (
        <AbsoluteFill className="items-start justify-start p-0">
          <Img
            src={mainImageUrl}
            className="h-[68%] w-full origin-[center_35%] object-cover"
            style={{transform: `scale(${zoom})`}}
          />
        </AbsoluteFill>
      ) : null}

      {/* Soft scrim behind the text — only the lower third, not full-frame.
          Keeps the image lively while making the caption legible. */}
      <AbsoluteFill className="bg-[linear-gradient(to_bottom,transparent_0%,transparent_55%,rgba(12,12,12,0.78)_75%,rgba(12,12,12,0.92)_100%)]" />

      {/* Caption — fixed lower-third box, font size bucketed by text length,
          line-clamp safety net so the rare too-long paragraph degrades to a
          tasteful ellipsis instead of overflowing into the image. */}
      <AbsoluteFill className="flex items-end justify-center px-[120px] pb-20 pt-0">
        <p
          className="m-0 max-w-[1440px] overflow-hidden text-center font-medium tracking-[-0.005em] text-white [-webkit-box-orient:vertical] [display:-webkit-box] [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]"
          style={{
            // Bucketed size + line clamp are dynamic per chunk length, so they
            // stay inline. Everything else above is static Tailwind.
            fontSize: cap.fontSize,
            lineHeight: cap.lineHeight,
            WebkitLineClamp: cap.maxLines,
          }}
        >
          {chunk.text}
        </p>
      </AbsoluteFill>

      <Audio src={chunk.audioUrl} />
    </AbsoluteFill>
  )
}

export const ArticleNarrated: React.FC<ArticleNarratedProps> = ({mainImageUrl, chunks}) => {
  const {fps} = useVideoConfig()

  // Walk the chunks once, computing the running frame offset. Each chunk lives
  // in its own Sequence so timing is exact (Remotion treats Sequence's `from`
  // as the absolute start frame of the child).
  let frameOffset = 0
  return (
    <AbsoluteFill className="bg-[#0c0c0c]">
      {chunks.map((chunk) => {
        const durationInFrames = Math.max(1, Math.ceil(chunk.durationSeconds * fps))
        const sequence = (
          <Sequence key={chunk.id} from={frameOffset} durationInFrames={durationInFrames}>
            <ChunkScene chunk={chunk} mainImageUrl={mainImageUrl} />
          </Sequence>
        )
        frameOffset += durationInFrames
        return sequence
      })}
    </AbsoluteFill>
  )
}
