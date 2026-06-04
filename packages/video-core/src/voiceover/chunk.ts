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
    .map((block): Chunk => ({
      text: (block.children ?? [])
        .filter((s): s is PtSpan => s?._type === 'span' && typeof s.text === 'string')
        .map((s) => s.text ?? '')
        .join('')
        .trim(),
    }))
    .filter((c) => c.text.length > 0)
}
