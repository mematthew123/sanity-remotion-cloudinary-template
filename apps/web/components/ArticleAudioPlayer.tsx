'use client';

import { useRef, useState } from 'react';
import { useAudioPlayback } from './AudioPlayback';

interface Props {
  /** The `podcast-mp3` variant URL from the narrated render. */
  src: string;
  /** Total runtime in seconds (from the video doc) — seeds the UI before the
   *  audio's own metadata loads, then gets replaced by the exact duration. */
  durationSeconds: number | null;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatListenLabel(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  return mins <= 1 ? '1 min listen' : `${mins} min listen`;
}

const SEEK_STEP_SECONDS = 5;

export default function ArticleAudioPlayer({ src, durationSeconds }: Props) {
  // When wrapped in <AudioPlaybackProvider> (narrated posts with a transcript),
  // share that single <audio> element so the transcript and this UI stay in
  // sync. Standalone, fall back to a local ref.
  const localRef = useRef<HTMLAudioElement>(null);
  const audioRef = useAudioPlayback()?.audioRef ?? localRef;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    durationSeconds && durationSeconds > 0 ? durationSeconds : 0,
  );

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const listenLabel = formatListenLabel(duration);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seekToCurrentTime(seconds: number) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const next = Math.min(duration, Math.max(0, seconds));
    audio.currentTime = next;
    setCurrentTime(next);
  }

  function handleTrackClick(event: React.MouseEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    seekToCurrentTime(fraction * duration);
  }

  function handleTrackKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        seekToCurrentTime(audio.currentTime + SEEK_STEP_SECONDS);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        seekToCurrentTime(audio.currentTime - SEEK_STEP_SECONDS);
        break;
      case 'Home':
        seekToCurrentTime(0);
        break;
      case 'End':
        seekToCurrentTime(duration);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <section className='mb-10 overflow-hidden rounded-xl bg-background shadow-sm ring-1 ring-foreground/10'>
      <div className='flex items-center justify-between gap-3 border-b border-foreground/10 px-5 py-3 font-mono text-xs tracking-[0.18em] uppercase'>
        <span className='text-accent'>▶ Listen to this article</span>
        {listenLabel && <span className='text-muted'>{listenLabel}</span>}
      </div>

      <div className='flex flex-wrap items-center gap-4 p-4'>
        <button
          type='button'
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-pressed={isPlaying}
          className='flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        >
          {isPlaying ? (
            <svg viewBox='0 0 24 24' className='size-6 fill-current' aria-hidden='true'>
              <rect x='6.5' y='5' width='3.5' height='14' />
              <rect x='14' y='5' width='3.5' height='14' />
            </svg>
          ) : (
            <svg viewBox='0 0 24 24' className='size-6 fill-current' aria-hidden='true'>
              <path d='M8 5v14l11-7z' />
            </svg>
          )}
        </button>

        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <div
            role='slider'
            tabIndex={0}
            aria-label='Seek audio'
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatClock(currentTime)} of ${formatClock(duration)}`}
            onClick={handleTrackClick}
            onKeyDown={handleTrackKeyDown}
            className='relative h-2 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          >
            <div
              className='absolute inset-y-0 left-0 rounded-full bg-accent'
              style={{ width: `${progress}%` }}
              aria-hidden='true'
            />
          </div>
          <span className='shrink-0 font-mono text-xs text-muted tabular-nums'>
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
        </div>

        <a
          href={src}
          download
          className='shrink-0 font-mono text-xs tracking-wide text-muted uppercase underline decoration-foreground/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground'
        >
          ↓ MP3
        </a>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload='metadata'
        className='hidden'
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const loaded = event.currentTarget.duration;
          if (Number.isFinite(loaded) && loaded > 0) setDuration(loaded);
        }}
      />
    </section>
  );
}
