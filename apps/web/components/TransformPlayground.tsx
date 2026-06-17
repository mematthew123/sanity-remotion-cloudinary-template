'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { PlaygroundVideo } from '@/lib/sanity.queries';

// Public Cloudinary transform playground — the same live-transform idea as the
// Studio VariantViewer, exposed to site visitors. Edit a transformation string
// (or pick a preset), choose an output format, and watch Cloudinary derive it
// from the one canonical render in real time. This is the most direct, hands-on
// demonstration of the "one render → infinite derivations" Cloudinary story.

type Format = 'mp4' | 'gif' | 'jpg';

// Each preset declares the output formats it actually produces a visible result
// in. Cloudinary's video pipeline supports a smaller effect set than its image
// pipeline: artistic effects like sepia/pixelate are image-only, while motion
// effects like boomerang are animated-only. Presets are disabled for formats
// they no-op on, so the limitation is legible instead of looking broken.
const ALL: Format[] = ['mp4', 'gif', 'jpg'];

const PRESETS: { label: string; transform: string; formats: Format[] }[] = [
  { label: 'Original', transform: '', formats: ALL },
  { label: 'Grayscale', transform: 'e_grayscale', formats: ALL },
  { label: 'Blur', transform: 'e_blur:800', formats: ALL },
  { label: 'Square crop', transform: 'c_fill,w_600,h_600,g_auto', formats: ALL },
  { label: 'Sepia', transform: 'e_sepia', formats: ['jpg'] },
  { label: 'Pixelate', transform: 'e_pixelate:12', formats: ['jpg'] },
  { label: 'Poster frame', transform: 'so_10p', formats: ['jpg'] },
  { label: 'Preview GIF', transform: 'w_540,du_3,fps_15,fl_lossy', formats: ['gif'] },
  { label: 'Boomerang', transform: 'e_boomerang,du_3', formats: ['mp4', 'gif'] },
];

const FORMATS: Format[] = ['mp4', 'gif', 'jpg'];

/** Why a preset is unavailable for the current output format. */
function disabledReason(formats: Format[]): string {
  const animated = formats.includes('mp4') || formats.includes('gif');
  if (formats.length === 1 && formats[0] === 'jpg') {
    return 'Image-only effect — switch output to JPG';
  }
  if (animated && !formats.includes('jpg')) {
    return 'Animated-only effect — switch output to MP4 or GIF';
  }
  return `Only available for ${formats.join(', ').toUpperCase()} output`;
}

interface Props {
  cloudName: string;
  videos: PlaygroundVideo[];
}

export default function TransformPlayground({ cloudName, videos }: Props) {
  const [videoId, setVideoId] = useState(videos[0]?._id ?? '');
  const [transform, setTransform] = useState('');
  const [format, setFormat] = useState<Format>('mp4');
  const [copied, setCopied] = useState(false);

  const video = videos.find((v) => v._id === videoId) ?? videos[0];
  const publicId = video?.cloudinaryPublicId ?? '';

  const url = useMemo(() => {
    const segment = transform.trim()
      ? `${transform.trim()}/${publicId}.${format}`
      : `${publicId}.${format}`;
    return `https://res.cloudinary.com/${cloudName}/video/upload/${segment}`;
  }, [cloudName, publicId, transform, format]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTransform(p.transform);
  }

  return (
    <div className='grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]'>
      {/* Preview */}
      <div className='min-w-0'>
        {/* Fixed, viewport-bounded stage: the media is letterboxed with
            object-contain so portrait/square/landscape renders all fit without
            blowing up the page height. */}
        <div className='relative h-[clamp(280px,55vh,600px)] w-full overflow-hidden rounded-xl bg-foreground/5 ring-1 ring-foreground/10'>
          {format === 'mp4' ? (
            <video
              key={url}
              src={url}
              controls
              autoPlay
              loop
              muted
              playsInline
              className='absolute inset-0 h-full w-full object-contain'
            />
          ) : (
            <Image
              key={url}
              src={url}
              alt='Transformed render'
              fill
              unoptimized
              sizes='(max-width: 1024px) 100vw, 720px'
              className='object-contain'
            />
          )}
        </div>

        {/* The resulting URL — the whole point: a plain, shareable CDN link. */}
        <div className='mt-4 flex min-w-0 items-stretch gap-2'>
          <code className='min-w-0 flex-1 overflow-x-auto rounded-lg bg-foreground/5 px-3 py-2 font-mono text-xs whitespace-nowrap text-muted ring-1 ring-foreground/10'>
            {url}
          </code>
          <button
            type='button'
            onClick={copy}
            className='shrink-0 rounded-lg bg-foreground px-4 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent'
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className='flex flex-col gap-6'>
        {videos.length > 1 && (
          <label className='flex flex-col gap-2'>
            <span className='font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase'>
              Source render
            </span>
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className='rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm'
            >
              {videos.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.title ?? v.template ?? v._id}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className='flex flex-col gap-2'>
          <span className='font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase'>
            Output format
          </span>
          <div className='flex gap-2'>
            {FORMATS.map((f) => (
              <button
                key={f}
                type='button'
                onClick={() => setFormat(f)}
                className={`rounded-full px-4 py-1.5 font-mono text-xs tracking-wide uppercase transition-colors ${
                  format === f
                    ? 'bg-foreground text-background'
                    : 'text-muted ring-1 ring-foreground/15 hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {format !== 'jpg' && (
            <p className='text-xs leading-relaxed text-muted/80'>
              Video & GIF derivations are generated asynchronously — the first
              load of a new transform may show the original until Cloudinary
              finishes processing.
            </p>
          )}
        </div>

        <label className='flex flex-col gap-2'>
          <span className='font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase'>
            Transformation
          </span>
          <input
            value={transform}
            onChange={(e) => setTransform(e.target.value)}
            spellCheck={false}
            placeholder='e_grayscale,w_600'
            className='rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm'
          />
        </label>

        <div className='flex flex-col gap-2'>
          <span className='font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase'>
            Presets
          </span>
          <div className='flex flex-wrap gap-2'>
            {PRESETS.map((p) => {
              const enabled = p.formats.includes(format);
              return (
                <button
                  key={p.label}
                  type='button'
                  disabled={!enabled}
                  onClick={() => applyPreset(p)}
                  title={enabled ? undefined : disabledReason(p.formats)}
                  className={`rounded-full px-3 py-1 text-xs ring-1 transition-colors ${
                    enabled
                      ? 'text-muted ring-foreground/15 hover:text-foreground hover:ring-foreground/40'
                      : 'cursor-not-allowed text-muted/35 ring-foreground/5 line-through'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
