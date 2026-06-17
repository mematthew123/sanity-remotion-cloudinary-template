'use client'

import { useState } from 'react'
// Safe to import from /registry in a client component: it is React-free
// metadata (labels + dimensions), no Remotion hooks evaluate here.
import { findComposition } from '@template/video-core/registry'
import type { PostVideo } from '@/lib/sanity.queries'

interface VideoPlayerProps {
  videos: PostVideo[]
}

export default function VideoPlayer({ videos }: VideoPlayerProps) {
  // Only render videos that actually have a Cloudinary URL.
  const playable = videos.filter((v) => v.cloudinaryUrl)

  const [activeId, setActiveId] = useState<string>(playable[0]?._id ?? '')

  if (playable.length === 0) return null

  const active = playable.find((v) => v._id === activeId) ?? playable[0]
  if (!active?.cloudinaryUrl) return null

  const meta = active.template ? findComposition(active.template) : undefined
  const width = active.width ?? meta?.width ?? 1080
  const height = active.height ?? meta?.height ?? 1080
  const isPortrait = height > width
  const label = meta?.label ?? active.template ?? 'Video'

  return (
    <section className='w-full border-t border-foreground/15 py-10'>
      <div className='mx-auto max-w-3xl px-4'>
        <h2 className='mb-6 font-mono text-xl font-extrabold tracking-tight uppercase'>
          Video
        </h2>

        {playable.length > 1 && (
          <div className='mb-6 flex flex-wrap gap-2'>
            {playable.map((video) => {
              const m = video.template ? findComposition(video.template) : undefined
              const tabLabel = m?.label ?? video.template ?? 'Video'
              const isActive = video._id === active._id
              return (
                <button
                  key={video._id}
                  onClick={() => setActiveId(video._id)}
                  className={`border px-4 py-2 font-mono text-xs font-bold tracking-wide uppercase transition-colors ${
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-foreground/30 text-foreground hover:border-foreground'
                  }`}
                >
                  {tabLabel}
                </button>
              )
            })}
          </div>
        )}

        <div
          className={`mx-auto border border-foreground bg-foreground ${
            isPortrait ? 'max-w-sm' : 'max-w-2xl'
          }`}
        >
          <video
            key={active._id}
            src={active.cloudinaryUrl}
            controls
            playsInline
            style={{
              aspectRatio: `${width}/${height}`,
              width: '100%',
              display: 'block',
            }}
          />
        </div>

        <div className='mt-4 flex items-center gap-4 font-mono text-xs text-muted uppercase'>
          <span>{label}</span>
          <span>{active.duration ?? 0}s</span>
          {active.renderedAt && (
            <span suppressHydrationWarning>
              Rendered{' '}
              {new Date(active.renderedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
