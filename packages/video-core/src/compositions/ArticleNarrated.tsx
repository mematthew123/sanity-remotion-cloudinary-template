import React from 'react'
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import type {ArticleNarratedChunk, ArticleNarratedProps} from '../types'
import '../fonts'

// Long-form narrated reading. Each chunk is one paragraph: its MP3 plays in a
// dedicated <Sequence>, with a Ken-Burns pan on the post's main image behind a
// large caption of the spoken text. The composition's total duration is set
// via `calculateMetadata` (see registry.ts) from the sum of chunk durations,
// so the composition body is purely presentational.

function ChunkScene({chunk, mainImageUrl}: {chunk: ArticleNarratedChunk; mainImageUrl?: string}) {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()

  // Subtle Ken Burns: gradual zoom from 1.0 → 1.08 across the scene length.
  // Keeping it gentle so the eye stays on the caption text.
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // 15-frame (0.5s @ 30fps) fade in and out per scene to soften paragraph cuts.
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'})
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <AbsoluteFill style={{backgroundColor: '#000', opacity}}>
      {mainImageUrl ? (
        <Img
          src={mainImageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom})`,
            opacity: 0.55,
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 96px 96px 96px',
        }}
      >
        <p
          style={{
            fontSize: 42,
            lineHeight: 1.4,
            fontWeight: 500,
            color: '#ffffff',
            textAlign: 'center',
            maxWidth: 1440,
            margin: 0,
            textShadow: '0 2px 16px rgba(0,0,0,0.85)',
            // Tracking-tight headlines read more cleanly at distance.
            letterSpacing: '-0.005em',
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
    <AbsoluteFill style={{backgroundColor: '#000'}}>
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
