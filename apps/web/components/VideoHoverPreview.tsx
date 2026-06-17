'use client';

import Image from 'next/image';
import { useState } from 'react';

// Home-feed card media that swaps the static article image for the post's
// `site-preview-gif` (a Cloudinary derivation of the promo render) on hover —
// the fan-out made tangible on the most-visited page. The GIF src is only
// mounted after the first hover so cards don't all fetch their loops up front.

interface Props {
  imageUrl: string | null;
  imageAlt: string;
  gifUrl: string | null;
  sizes?: string;
}

export default function VideoHoverPreview({
  imageUrl,
  imageAlt,
  gifUrl,
  sizes,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [hovered, setHovered] = useState(false);

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
      {gifUrl && armed && (
        <Image
          src={gifUrl}
          alt=''
          aria-hidden
          fill
          unoptimized
          sizes={sizes}
          className={`object-cover transition-opacity duration-300 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {gifUrl && (
        <span className='pointer-events-none absolute bottom-2 left-2 rounded-full bg-foreground/75 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-background uppercase backdrop-blur-sm'>
          ▶ Preview
        </span>
      )}
    </div>
  );
}
