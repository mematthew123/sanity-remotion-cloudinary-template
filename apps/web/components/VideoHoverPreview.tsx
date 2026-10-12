'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// Home-feed card media that plays the post's render (`site-mp4`, a Cloudinary
// derivation of the promo) once on hover, then fades back to the still — the
// fan-out made tangible on the most-visited page. No loop: the looping
// `site-preview-gif` is for email, which can't play video. The video src is
// only mounted after the first hover so cards don't all fetch up front.

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Each hover restarts from the top; leaving pauses (which fades it out).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered, armed]);

  return (
    <div
      className='relative size-full'
      onMouseEnter={() => {
        setArmed(true);
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes={sizes}
          className='object-cover transition-transform duration-500 group-hover:scale-[1.03]'
        />
      )}
      {videoUrl && armed && (
        <video
          ref={videoRef}
          src={videoUrl}
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
      {videoUrl && (
        <span className='pointer-events-none absolute bottom-2 left-2 rounded-full bg-foreground/75 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-background uppercase backdrop-blur-sm'>
          ▶ Preview
        </span>
      )}
    </div>
  );
}
