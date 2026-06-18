import type {Chunk} from './types'

// Loose Portable Text shape — we don't pull `@sanity/types` into video-core
// (it would bring a Node dep tree into the Studio's Vite bundle). The runtime
// shape from Sanity matches this; downstream consumers narrow as needed.
type PtSpan = {_type: 'span'; text?: string; marks?: string[]}
type PtBlock = {_type: 'block'; style?: string; children?: PtSpan[]}

function isPtBlock(node: unknown): node is PtBlock {
  return (
    typeof node === 'object' &&
    node !== null &&
    '_type' in node &&
    (node as {_type: unknown})._type === 'block'
  )
}

/** Concatenated, trimmed text of a block's spans — the unit the narrator speaks. */
function blockText(block: PtBlock): string {
  return (block.children ?? [])
    .filter((s): s is PtSpan => s?._type === 'span' && typeof s.text === 'string')
    .map((s) => s.text ?? '')
    .join('')
    .trim()
}

/**
 * One chunk per Portable Text block — the narrator pauses at paragraph breaks.
 * Empty blocks (or blocks containing only whitespace) are dropped so we don't
 * pay ElevenLabs for "" → silence. Non-block items (images, custom embeds) are
 * ignored; future iterations may emit narration cues like "(image)" or render
 * the image as a scene without narration.
 */
export function chunkPortableTextForNarration(
  body: unknown[] | null | undefined,
): Chunk[] {
  if (!body || !Array.isArray(body)) return []
  return body
    .filter(isPtBlock)
    .map((block): Chunk => ({text: blockText(block)}))
    .filter((c) => c.text.length > 0)
}

/** A heading block, paired with the narration chunk index it introduces. */
export type NarrationChapter = {title: string; chunkIndex: number}
/** A body image, paired with the chunk index it appears after (-1 = before the first). */
export type NarrationImage = {url: string; afterChunkIndex: number}
export type NarrationScenes = {chapters: NarrationChapter[]; images: NarrationImage[]}

// Heading styles that open a chapter. Headings are themselves narrated (the
// chunker speaks every block), so a chapter's `chunkIndex` is exactly the
// index of the heading's own chunk — the chapter card shows as it's read.
const HEADING_STYLES = new Set(['h1', 'h2', 'h3'])

/**
 * Walk the same Portable Text body the chunker does and pull out the visual
 * scene data the narrated composition needs:
 *
 * - `chapters` — heading blocks, tagged with the chunk index they introduce.
 * - `images` — body image blocks, tagged with the chunk they follow.
 *
 * Indices are kept in lockstep with `chunkPortableTextForNarration` (same
 * empty-block drop, same block counting) so the composition can map an index
 * straight onto a chunk's start frame. Image URLs must be pre-resolved by the
 * caller's GROQ projection (`"imageUrl": asset->url`) — this stays free of any
 * Sanity asset-deref dependency.
 */
export function extractNarrationScenes(
  body: unknown[] | null | undefined,
): NarrationScenes {
  const chapters: NarrationChapter[] = []
  const images: NarrationImage[] = []
  if (!body || !Array.isArray(body)) return {chapters, images}

  let chunkIndex = 0
  for (const node of body) {
    if (isPtBlock(node)) {
      const text = blockText(node)
      if (text.length === 0) continue // dropped by the chunker too — keep indices aligned
      if (node.style && HEADING_STYLES.has(node.style)) {
        chapters.push({title: text, chunkIndex})
      }
      chunkIndex += 1
    } else if (
      typeof node === 'object' &&
      node !== null &&
      (node as {_type?: unknown})._type === 'image'
    ) {
      const url = (node as {imageUrl?: unknown}).imageUrl
      if (typeof url === 'string' && url.length > 0) {
        images.push({url, afterChunkIndex: chunkIndex - 1})
      }
    }
  }
  return {chapters, images}
}
