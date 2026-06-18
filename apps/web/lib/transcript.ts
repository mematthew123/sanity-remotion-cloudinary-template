// Structured, absolute-timed transcript for the interactive "read along" panel.
//
// Same source + same cumulative clock as the captions.vtt builder, but shaped
// for the UI: paragraphs with per-word absolute start/end (seconds on the audio
// timeline) so the player can highlight the current word and seek to any word.
// Words are present only once ElevenLabs forced alignment has run; otherwise a
// paragraph still renders and is click-to-seekable at the paragraph level.

import type { CaptionChunk } from './captions';

export type TranscriptWord = { text: string; start: number; end: number };
export type TranscriptParagraph = {
  index: number;
  start: number;
  end: number;
  text: string;
  /** Empty when the chunk hasn't been word-aligned yet. */
  words: TranscriptWord[];
};

export function buildTranscript(chunks: CaptionChunk[]): TranscriptParagraph[] {
  const paragraphs: TranscriptParagraph[] = [];
  let clock = 0;

  for (const chunk of chunks) {
    const duration = chunk.durationSeconds ?? 0;
    if (duration <= 0) continue;

    const start = clock;
    const end = clock + duration;
    clock = end;

    const text = chunk.text?.trim();
    if (!text) continue;

    const words: TranscriptWord[] = (chunk.words ?? [])
      .filter(
        (w): w is { text: string; start: number; end: number } =>
          typeof w.text === 'string' &&
          w.text.trim().length > 0 &&
          typeof w.start === 'number' &&
          typeof w.end === 'number',
      )
      // Offset clip-relative word times onto the absolute audio timeline.
      .map((w) => ({ text: w.text.trim(), start: start + w.start, end: start + w.end }));

    paragraphs.push({ index: paragraphs.length, start, end, text, words });
  }

  return paragraphs;
}
