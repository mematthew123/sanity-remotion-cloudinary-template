import React from 'react'
import {Easing, interpolate} from 'remotion'
import {AUTHORED_FPS} from './timeline'

// =============================================================================
// Motion primitives shared by every composition
// =============================================================================
//
// One small vocabulary so the three videos move like one family:
// - a handful of named easing curves (no springs — every beat has an exact
//   start and length, which is what lets the timelines be data),
// - `tween()` for a clamped 0→1 progress,
// - masked line reveals for display type,
// - a deterministic fitter for the monospace headline.

export const EASE = {
  /** Entrances: fast start, long settle. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Big moves that start and end at rest (curtains, wipes). */
  inOut: Easing.bezier(0.76, 0, 0.24, 1),
  /** Exits and impacts: gathers speed. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  /** Small overshoot for stickers and badges. Use sparingly. */
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Gentle symmetric curve for dissolves. */
  soft: Easing.bezier(0.45, 0, 0.55, 1),
} as const

/** Clamped 0→1 progress starting at `start` and lasting `duration` frames. */
export function tween(
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = EASE.out,
): number {
  return interpolate(frame, [start, start + Math.max(1e-6, duration)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  })
}

export const mix = (progress: number, from: number, to: number) => from + (to - from) * progress

/**
 * Convert a beat authored at 30fps to the composition's real fps, so the
 * choreography keeps its feel if a composition is registered at another rate.
 */
export const atFps = (fps: number) => (frames: number) => Math.round((frames * fps) / AUTHORED_FPS)

// -----------------------------------------------------------------------------
// Masked reveals
// -----------------------------------------------------------------------------

/**
 * A line that rises into view from behind its own baseline. The mask is padded
 * so descenders and commas aren't shaved off once the line is at rest.
 */
export const MaskedLine: React.FC<{
  progress: number
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}> = ({progress, children, className, style}) => (
  <div
    className={className}
    style={{overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em', ...style}}
  >
    <div style={{transform: `translateY(${(1 - progress) * 112}%)`, whiteSpace: 'nowrap'}}>
      {children}
    </div>
  </div>
)

/**
 * Reveal for a block of wrapping text (where we don't know the line breaks):
 * the block is uncovered top-down while it settles upward.
 */
export function blockReveal(progress: number, travel = 28): React.CSSProperties {
  return {
    clipPath: `inset(-0.2em -0.2em ${(1 - progress) * 100}% -0.2em)`,
    transform: `translateY(${(1 - progress) * travel}px)`,
  }
}

// -----------------------------------------------------------------------------
// Monospace headline fitting
// -----------------------------------------------------------------------------
//
// JetBrains Mono advances exactly 0.6em per glyph, so the headline can be
// wrapped and sized with arithmetic — no DOM measuring, identical on every
// render worker. Knowing the lines up front is also what makes the per-line
// masked reveal possible.

const MONO_ADVANCE_EM = 0.6

// Width of a string in glyph cells. CJK / full-width glyphs fall back to a
// wider face, so they count as wider cells; `spaceCells` is the width of a
// word space (under 1 when word-spacing is tightened).
const cellsOf = (text: string, spaceCells: number) => {
  let cells = 0
  for (const ch of text) {
    cells += ch === ' ' ? spaceCells : (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1.7 : 1
  }
  return cells
}

function wrapCells(words: string[], maxCells: number, spaceCells: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && cellsOf(candidate, spaceCells) > maxCells) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export type FittedLines = {lines: string[]; fontSize: number; lineHeight: number}

export function fitMonoLines(
  text: string,
  opts: {
    maxWidth: number
    maxHeight: number
    maxLines: number
    minSize: number
    maxSize: number
    /** CSS letter-spacing in em (negative tightens). */
    tracking?: number
    /** CSS word-spacing in em. A mono space is a full glyph wide — too airy at display sizes. */
    wordSpacing?: number
    lineHeight?: number
  },
): FittedLines {
  const {maxWidth, maxHeight, maxLines, minSize, maxSize, tracking = 0, wordSpacing = 0} = opts
  const lineHeight = opts.lineHeight ?? 1.04
  const advance = MONO_ADVANCE_EM + tracking
  const space = (advance + wordSpacing) / advance
  const cells = (text: string) => cellsOf(text, space)
  const wrap = (maxCells: number) => wrapCells(words, maxCells, space)
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return {lines: [], fontSize: minSize, lineHeight}

  const longestWord = Math.max(...words.map(cells))
  const widest = (lines: string[]) => Math.max(...lines.map(cells))
  const sizeFor = (lines: string[]) =>
    Math.min(maxSize, maxWidth / (widest(lines) * advance), maxHeight / (lines.length * lineHeight))

  // Try every line count: wrap as tightly as that count allows (which also
  // balances the rag), then take whichever count yields the largest type.
  let best: FittedLines | undefined
  const totalCells = cells(words.join(' '))
  for (let count = 1; count <= Math.min(maxLines, words.length); count++) {
    let lines: string[] | undefined
    for (let width = Math.max(longestWord, totalCells / count); width <= totalCells + 1; width += 0.5) {
      const attempt = wrap(width)
      if (attempt.length <= count) {
        lines = attempt
        break
      }
    }
    if (!lines) continue
    const fontSize = sizeFor(lines)
    if (!best || fontSize > best.fontSize + 0.5) best = {lines, fontSize, lineHeight}
  }

  if (best && best.fontSize >= minSize) return {...best, fontSize: Math.floor(best.fontSize)}

  // Too long to fit even at the minimum size: wrap at the minimum and truncate.
  const lines = wrap(Math.floor(maxWidth / (minSize * advance)))
  const rows = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (minSize * lineHeight))))
  if (lines.length > rows) {
    lines.length = rows
    lines[rows - 1] = `${lines[rows - 1].replace(/[\s.,;:!?-]+$/, '')}…`
  }
  // A single unbreakable word can still be wider than the frame at the minimum
  // size — let that one case shrink further rather than run off the edge.
  return {lines, fontSize: Math.floor(Math.min(minSize, maxWidth / (widest(lines) * advance))), lineHeight}
}

/**
 * Pick a size for wrapping (proportional) text from its length: the largest of
 * `sizes` whose estimated line count fits `maxLines`. An estimate, so pair it
 * with a `line-clamp` as the hard stop.
 */
export function fitProseSize(
  text: string,
  opts: {maxWidth: number; maxLines: number; sizes: readonly number[]; avgCharEm?: number},
): number {
  const {maxWidth, maxLines, sizes, avgCharEm = 0.4} = opts
  for (const size of sizes) {
    const perLine = Math.max(1, Math.floor(maxWidth / (size * avgCharEm)))
    if (Math.ceil(text.length / perLine) <= maxLines) return size
  }
  return sizes[sizes.length - 1]
}

/** Uppercase short date for mono labels, e.g. `JAN 1, 2026`. Empty if unparseable. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date
    .toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
    .toUpperCase()
}
