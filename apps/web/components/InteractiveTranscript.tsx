'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayback } from './AudioPlayback';
import type { TranscriptParagraph } from '@/lib/transcript';

interface Props {
  paragraphs: TranscriptParagraph[];
}

type FlatWord = { start: number; pIndex: number; wIndex: number };

export default function InteractiveTranscript({ paragraphs }: Props) {
  const playback = useAudioPlayback();
  // Collapsed by default — optional read-along over the article body.
  const [open, setOpen] = useState(false);
  // `${p}:${w}` for the active word, `${p}` for paragraph fallback, or null.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);
  // Auto-scroll follow mode: on while playing, off on manual scroll.
  const followRef = useRef(true);

  // Flattened, start-sorted word index for O(log n) lookup.
  const flat = useMemo<FlatWord[]>(() => {
    const out: FlatWord[] = [];
    for (const p of paragraphs) {
      p.words.forEach((w, wIndex) => out.push({ start: w.start, pIndex: p.index, wIndex }));
    }
    return out;
  }, [paragraphs]);
  const hasWords = flat.length > 0;

  // Drive the active key off the shared <audio> via rAF, re-rendering only
  // when the active word changes — not every frame.
  useEffect(() => {
    if (!open) return;
    const audio = playback?.audioRef.current;
    if (!audio) return;

    let raf = 0;
    let lastKey: string | null = null;
    const apply = (key: string | null) => {
      if (key !== lastKey) {
        lastKey = key;
        setActiveKey(key);
      }
    };

    const compute = () => {
      const t = audio.currentTime;
      if (hasWords) {
        // Rightmost word with start <= t (holds last word during gaps).
        let lo = 0;
        let hi = flat.length - 1;
        let idx = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (flat[mid].start <= t) {
            idx = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        apply(idx >= 0 ? `${flat[idx].pIndex}:${flat[idx].wIndex}` : null);
      } else {
        const p = paragraphs.find((para) => t >= para.start && t < para.end);
        apply(p ? `${p.index}` : null);
      }
    };

    const tick = () => {
      compute();
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      followRef.current = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onStop = () => {
      cancelAnimationFrame(raf);
      compute();
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onStop);
    audio.addEventListener('seeked', onStop);
    audio.addEventListener('ended', onStop);

    compute();
    if (!audio.paused) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onStop);
      audio.removeEventListener('seeked', onStop);
      audio.removeEventListener('ended', onStop);
    };
  }, [open, playback, flat, hasWords, paragraphs]);

  // Manual scroll disables follow; play re-enables it (see onPlay).
  useEffect(() => {
    const disable = () => {
      followRef.current = false;
    };
    window.addEventListener('wheel', disable, { passive: true });
    window.addEventListener('touchmove', disable, { passive: true });
    return () => {
      window.removeEventListener('wheel', disable);
      window.removeEventListener('touchmove', disable);
    };
  }, []);

  // Keep the active word centred while following.
  useEffect(() => {
    if (!followRef.current) return;
    activeElRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeKey]);

  // Parse the active key for played/active styling.
  let activeP = -1;
  let activeW = -1;
  if (activeKey) {
    const [p, w] = activeKey.split(':');
    activeP = Number(p);
    activeW = w === undefined ? Number.POSITIVE_INFINITY : Number(w);
  }

  if (paragraphs.length === 0) return null;

  return (
    <section className='mb-10 overflow-hidden rounded-xl bg-background shadow-sm ring-1 ring-foreground/10'>
      <button
        type='button'
        onClick={() => {
          // Re-engage follow on expand so it scrolls to the current word.
          if (!open) followRef.current = true;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className='flex w-full items-center justify-between gap-3 px-5 py-3 font-mono text-xs tracking-[0.18em] uppercase transition-colors hover:bg-foreground/[0.02]'
      >
        <span className='text-accent'>▶ Read along</span>
        <span className='flex items-center gap-2 text-muted'>
          {open ? 'Tap any word to jump' : 'Show transcript'}
          <span aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </span>
      </button>

      {open && (
      <div className='max-h-[28rem] overflow-y-auto border-t border-foreground/10 px-5 py-5 font-serif text-lg/relaxed'>
        {paragraphs.map((p) => {
          const paragraphActive = activeKey === `${p.index}`;

          if (p.words.length === 0) {
            // Not word-aligned yet: seek to the paragraph start.
            return (
              <p key={p.index} className='mb-4 last:mb-0'>
                <button
                  type='button'
                  onClick={() => playback?.seek(p.start)}
                  ref={paragraphActive ? (el) => void (activeElRef.current = el) : undefined}
                  className={`cursor-pointer rounded text-left transition-colors hover:text-foreground ${
                    paragraphActive ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {p.text}
                </button>
              </p>
            );
          }

          return (
            <p key={p.index} className='mb-4 last:mb-0'>
              {p.words.map((w, wi) => {
                const isActive = p.index === activeP && wi === activeW;
                const isPlayed =
                  p.index < activeP || (p.index === activeP && wi <= activeW);
                return (
                  <span key={wi}>
                    <button
                      type='button'
                      onClick={() => playback?.seek(w.start)}
                      ref={isActive ? (el) => void (activeElRef.current = el) : undefined}
                      className={`cursor-pointer rounded px-0.5 transition-colors duration-150 hover:bg-accent/10 ${
                        isActive
                          ? 'bg-accent/20 text-foreground'
                          : isPlayed
                            ? 'text-foreground'
                            : 'text-muted'
                      }`}
                    >
                      {w.text}
                    </button>{' '}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
      )}
    </section>
  );
}
