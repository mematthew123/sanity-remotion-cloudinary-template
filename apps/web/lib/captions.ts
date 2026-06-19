// WebVTT builder for the narrated reading's closed captions.
//
// Each narration chunk carries a `durationSeconds` (its slice of the timeline)
// and, once ElevenLabs forced alignment has run, a `words[]` array with
// per-word start/end RELATIVE to that chunk's own audio. We walk the chunks in
// order, advancing a cumulative clock by each chunk's duration, and emit:
//
//   - word-level cues (grouped into short, readable lines) when `words` exist,
//   - one paragraph-level cue otherwise (back-compat for posts generated before
//     alignment landed).
//
// The clock advances by `durationSeconds`, never by the last word's end, so
// captions stay locked to the same timeline the audio and render use.

export type CaptionWord = {text?: string | null; start?: number | null; end?: number | null}
export type CaptionChunk = {
  text?: string | null
  durationSeconds?: number | null
  words?: CaptionWord[] | null
}

// Subtitle readability: cap a cue at ~2 short lines and a few seconds so it
// never lingers or wall-of-texts.
const MAX_CUE_CHARS = 42
const MAX_CUE_SECONDS = 5

function timestamp(seconds: number): string {
  const safe = Math.max(0, seconds)
  const ms = Math.floor((safe % 1) * 1000)
  const whole = Math.floor(safe)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

type Cue = {start: number; end: number; text: string}

/** Group one chunk's words into short cues, offset onto the absolute timeline. */
function wordCues(words: CaptionWord[], offset: number): Cue[] {
  const clean = words.filter(
    (w): w is {text: string; start: number; end: number} =>
      typeof w.text === 'string' &&
      w.text.trim().length > 0 &&
      typeof w.start === 'number' &&
      typeof w.end === 'number',
  )
  if (clean.length === 0) return []

  const cues: Cue[] = []
  let line: string[] = []
  let lineStart: number | null = null

  const flush = (end: number) => {
    if (line.length === 0 || lineStart === null) return
    cues.push({start: lineStart, end, text: line.join(' ')})
    line = []
    lineStart = null
  }

  for (const w of clean) {
    if (lineStart === null) lineStart = offset + w.start
    line.push(w.text.trim())
    const wordEnd = offset + w.end
    const tooLong = line.join(' ').length >= MAX_CUE_CHARS
    const tooSlow = wordEnd - lineStart >= MAX_CUE_SECONDS
    const endsSentence = /[.!?…]['")\]]?$/.test(w.text.trim())
    if (tooLong || tooSlow || endsSentence) flush(wordEnd)
  }
  flush(offset + clean[clean.length - 1].end)
  return cues
}

/** Build a complete WebVTT document from the post's narration chunks. */
export function buildVtt(chunks: CaptionChunk[]): string {
  const cues: Cue[] = []
  let clock = 0

  for (const chunk of chunks) {
    const duration = chunk.durationSeconds ?? 0
    if (duration <= 0) continue

    if (chunk.words && chunk.words.length > 0) {
      cues.push(...wordCues(chunk.words, clock))
    } else {
      const text = chunk.text?.trim()
      if (text) cues.push({start: clock, end: clock + duration, text})
    }
    clock += duration
  }

  const body = cues
    .map((c) => `${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}
