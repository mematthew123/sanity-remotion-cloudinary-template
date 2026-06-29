'use client'

import { useState } from 'react'
import { CldVideoPlayer } from 'next-cloudinary'
import 'next-cloudinary/dist/cld-video-player.css'
import { stegaClean } from 'next-sanity'
// Safe to import from /registry in a client component: it is React-free
// metadata (labels + dimensions), no Remotion hooks evaluate here.
import { findComposition } from '@template/video-core/registry'
import type { PostVideo } from '@/lib/sanity.queries'

interface VideoPlayerProps {
  videos: PostVideo[]
}


function cloudNameFromUrl(url?: string | null): string | undefined {
  return url?.match(/res\.cloudinary\.com\/([^/]+)\//)?.[1]
}

export default function VideoPlayer({ videos }: VideoPlayerProps) {
  // Only render videos that actually have a Cloudinary URL.
  const playable = videos.filter((v) => v.cloudinaryUrl)

  const [activeId, setActiveId] = useState<string>(playable[0]?._id ?? '')

  if (playable.length === 0) return null

  const active = playable.find((v) => v._id === activeId) ?? playable[0]
  if (!active?.cloudinaryUrl) return null

  // stegaClean before the registry key lookup — stega chars (present in draft
  // mode) would miss the COMPOSITIONS_BY_ID key and drop the label/dimensions.
  const activeTemplate = stegaClean(active.template)
  const meta = activeTemplate ? findComposition(activeTemplate) : undefined
  const width = active.width ?? meta?.width ?? 1080
  const height = active.height ?? meta?.height ?? 1080
  const isPortrait = height > width
  const label = meta?.label ?? active.template ?? 'Video'

  // Drive Cloudinary's player off the public id when we can resolve the cloud
  // name; otherwise fall back to a plain <video> on the persisted URL.
  const cloudName = cloudNameFromUrl(active.cloudinaryUrl)
  const useCldPlayer = Boolean(active.cloudinaryPublicId && cloudName)

  return (
    <section className='w-full border-t border-foreground/10 py-12'>
      <div className='mx-auto max-w-3xl px-4'>
        <h2 className='mb-6 font-serif text-2xl tracking-tight'>Video</h2>

        {playable.length > 1 && (
          <div className='mb-6 flex flex-wrap gap-2'>
            {playable.map((video) => {
              const t = stegaClean(video.template)
              const m = t ? findComposition(t) : undefined
              const tabLabel = m?.label ?? video.template ?? 'Video'
              const isActive = video._id === active._id
              return (
                <button
                  key={video._id}
                  onClick={() => setActiveId(video._id)}
                  className={`rounded-full px-4 py-1.5 font-mono text-xs tracking-wide uppercase transition-colors ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'text-muted ring-1 ring-foreground/15 hover:text-foreground hover:ring-foreground/40'
                  }`}
                >
                  {tabLabel}
                </button>
              )
            })}
          </div>
        )}

        <div
          className={`mx-auto overflow-hidden rounded-xl bg-foreground ring-1 ring-foreground/10 ${
            isPortrait ? 'max-w-sm' : 'max-w-2xl'
          }`}
        >
          {useCldPlayer ? (
            <CldVideoPlayer
              key={active._id}
              src={active.cloudinaryPublicId!}
              config={{ cloud: { cloudName } }}
              width={width}
              height={height}
              poster={active.posterUrl ?? undefined}
              logo={false}
            />
          ) : (
            <video
              key={active._id}
              src={active.siteMp4Url ?? active.cloudinaryUrl}
              poster={active.posterUrl ?? undefined}
              controls
              playsInline
              style={{
                aspectRatio: `${width}/${height}`,
                width: '100%',
                display: 'block',
              }}
            />
          )}
        </div>

        <div className='mt-4 flex items-center gap-4 font-mono text-xs tracking-wide text-muted uppercase'>
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
