// =============================================================================
// Composition timelines
// =============================================================================
//
// One beat sheet per composition, authored in frames at 30fps. React-free on
// purpose: the compositions read these to choreograph, and `registry.ts` reads
// them for the duration and the poster frame — so the still-frame variants can
// never drift from the animation they are sampled from.
//
// Shape of a short-form video (promo, teaser):
//
//   ident ─ curtain opens ─ build ─────────── hold ─ curtain closes ─ ident
//   0                       ↑ title lands            ↑ poster frame          end
//
// The video opens and closes on the same brand ident, so it loops seamlessly
// wherever it autoplays. The title is fully on screen inside the first 3s —
// the `site-preview-gif` variant is a loop of exactly that window.

export const AUTHORED_FPS = 30

export const PROMO_TIMELINE = {
  duration: 240, // 8s
  /** Curtain collapses from full-frame ident into the header bar. */
  curtainOpen: {at: 5, for: 22},
  image: {at: 14, for: 28},
  kicker: {at: 26, for: 16},
  /** First title line; later lines follow `titleStagger` apart. */
  title: {at: 22, for: 26},
  titleStagger: 5,
  quote: {at: 62, for: 24},
  author: {at: 80, for: 22},
  cta: {at: 94, for: 24},
  /** Everything has settled — where the poster / social card is grabbed. */
  poster: 165,
  /** Curtain drops back to the ident this many frames before the end. */
  curtainClose: {before: 34, for: 22},
} as const

export const TEASER_TIMELINE = {
  duration: 210, // 7s
  curtainOpen: {at: 5, for: 22},
  kicker: {at: 24, for: 18},
  title: {at: 18, for: 26},
  titleStagger: 5,
  /** Highlighter swipe across the last title line. */
  highlight: {at: 56, for: 16},
  /** Stamp flies in for `for` frames; flash + shake fire as it lands. */
  stamp: {at: 70, for: 7},
  quote: {at: 86, for: 16},
  author: {at: 118, for: 20},
  cta: {at: 128, for: 24},
  poster: 165,
  curtainClose: {before: 32, for: 22},
} as const

export const NARRATED_TIMELINE = {
  /** Title card over the opening b-roll. */
  intro: 96,
  introExit: 20,
  /** Brand card over the closing b-roll; the last `fadeOut` frames go to black. */
  outro: 96,
  fadeOut: 14,
  /** Half-length of a b-roll cross-dissolve (centred on the scene boundary). */
  sceneFade: 24,
  /** How long a chapter card holds (shortened if the next chapter is close). */
  chapterCard: 120,
  /** Title settled, exit not begun. */
  poster: 54,
} as const

/** Poster time in seconds for a timeline's `poster` frame. */
export function posterSecondsOf(timeline: {poster: number}): number {
  return timeline.poster / AUTHORED_FPS
}
