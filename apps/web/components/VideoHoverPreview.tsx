'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Home-feed card media that plays the post's render (`site-mp4`, a Cloudinary
// derivation of the promo) once on hover, then fades back to the still — the
// fan-out made tangible on the most-visited page. No loop: the looping
// `site-preview-gif` is for email, which can't play video. The video src is
// only mounted after the first hover so cards don't all fetch up front.
//
// Triggered by hovering or keyboard-focusing the whole card (the enclosing
// link), and only where it makes sense: devices with a real hover, for users
// who haven't asked for reduced motion. Elsewhere the card is just the still.

const PREVIEW_QUERY = '(hover: hover) and (prefers-reduced-motion: no-preference)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PREVIEW_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePreviewAllowed() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PREVIEW_QUERY).matches,
    () => false,
  );
}

interface Props {
  imageUrl: string | null;
  imageAlt: string;
  videoUrl: string | null;
  sizes?: string;
}

export default function VideoHoverPreview({
  imageUrl,
  imageAlt,
  videoUrl,
  sizes,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const previewAllowed = usePreviewAllowed() && Boolean(videoUrl);

  // Listen on the whole card (the enclosing link, when there is one) so hover
  // anywhere on the row and keyboard focus on the link both start the preview.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !previewAllowed) return;
    const target: HTMLElement = root.closest('a') ?? root;
    const start = () => {
      setArmed(true);
      setActive(true);
    };
    const stop = () => setActive(false);
    target.addEventListener('mouseenter', start);
    target.addEventListener('mouseleave', stop);
    target.addEventListener('focus', start);
    target.addEventListener('blur', stop);
    return () => {
      target.removeEventListener('mouseenter', start);
      target.removeEventListener('mouseleave', stop);
      target.removeEventListener('focus', start);
      target.removeEventListener('blur', stop);
    };
  }, [previewAllowed]);

  // Each activation restarts from the top; deactivating pauses (which fades it out).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active, armed]);

  return (
    <div ref={rootRef} className='relative size-full'>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes={sizes}
          className='object-cover transition-transform duration-500 group-hover:scale-[1.03]'
        />
      )}
      {previewAllowed && armed && (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          aria-hidden
          muted
          playsInline
          preload='auto'
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
            playing ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {previewAllowed && (
        <span className='pointer-events-none absolute bottom-2 left-2 rounded-full bg-foreground/75 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-background uppercase backdrop-blur-sm'>
          ▶ Preview
        </span>
      )}
    </div>
  );
}
