import React from 'react'

// Placeholder wordmark — replace with your brand.
export const BRAND = 'ACME'

// The lockup is a square mark + the wordmark in JetBrains Mono ExtraBold. Mono
// glyphs advance 0.6em, so its width is known without measuring — which lets
// the ident be centred and then travel to its resting corner with arithmetic.
const MARK_EM = 0.62
const GAP_EM = 0.3
const GLYPH_EM = 0.6

export const lockupWidth = (fontSize: number, text: string = BRAND) =>
  (MARK_EM + GAP_EM + text.length * GLYPH_EM) * fontSize

/**
 * Travel of the lockup between the centred, full-size ident (`progress` 0) and
 * its small resting place (`progress` 1). Returns a transform for an element
 * rendered at `identSize` and pinned to the frame's top-left corner.
 */
export function lockupTransform(
  progress: number,
  opts: {
    frameWidth: number
    frameHeight: number
    identSize: number
    restSize: number
    restX: number
    restY: number
  },
): string {
  const {frameWidth, frameHeight, identSize, restSize, restX, restY} = opts
  const x = (frameWidth - lockupWidth(identSize)) / 2
  const y = (frameHeight - identSize) / 2
  const tx = x + (restX - x) * progress
  const ty = y + (restY - y) * progress
  const scale = 1 + (restSize / identSize - 1) * progress
  return `translate(${tx}px, ${ty}px) scale(${scale})`
}

export const Lockup: React.FC<{
  fontSize: number
  color: string
  markColor: string
  transform: string
}> = ({fontSize, color, markColor, transform}) => (
  <div
    className="absolute top-0 left-0 flex items-center font-mono font-extrabold whitespace-nowrap uppercase"
    style={{fontSize, lineHeight: 1, color, transform, transformOrigin: '0 0'}}
  >
    <span style={{width: `${MARK_EM}em`, height: `${MARK_EM}em`, marginRight: `${GAP_EM}em`, backgroundColor: markColor}} />
    {BRAND}
  </div>
)
