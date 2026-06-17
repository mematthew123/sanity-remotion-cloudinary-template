import Link from 'next/link';
import { client } from '@/lib/sanity.client';
import { ALL_VIDEOS_QUERY } from '@/lib/sanity.queries';
// React-free metadata import — labels and fallback dimensions only.
import { findComposition } from '@template/video-core/registry';

export const revalidate = 60;

export const metadata = {
  title: 'Videos',
  description:
    'Every video rendered from Sanity content with Remotion and served via Cloudinary.',
};

export default async function VideosPage() {
  const videos = await client.fetch(ALL_VIDEOS_QUERY);
  const playable = videos.filter((v) => v.cloudinaryUrl);

  return (
    <div className='mx-auto max-w-6xl px-6 py-20'>
      <header className='mb-14 border-b border-foreground/10 pb-10'>
        <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
          The render gallery
        </span>
        <h1 className='mt-4 font-serif text-5xl tracking-tight'>Videos</h1>
        <p className='mt-4 max-w-xl font-serif text-xl leading-relaxed text-muted italic'>
          Rendered with Remotion, served from Cloudinary.
        </p>
      </header>

      {playable.length === 0 ? (
        <p className='text-muted'>Nothing here yet.</p>
      ) : (
        <ul className='grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3'>
          {playable.map((video) => {
            const meta = video.template
              ? findComposition(video.template)
              : undefined;
            const width = video.width ?? meta?.width ?? 1080;
            const height = video.height ?? meta?.height ?? 1080;
            const label = meta?.label ?? video.template ?? 'Video';
            const postSlug = video.post?.slug?.current ?? null;

            return (
              <li key={video._id} className='group flex flex-col'>
                <div className='overflow-hidden rounded-xl bg-foreground shadow-sm ring-1 ring-foreground/10'>
                  <video
                    src={video.cloudinaryUrl!}
                    controls
                    playsInline
                    style={{
                      aspectRatio: `${width}/${height}`,
                      width: '100%',
                      display: 'block',
                    }}
                  />
                </div>
                <div className='flex flex-1 flex-col gap-1.5 px-1 pt-4'>
                  <span className='font-mono text-[0.7rem] tracking-[0.18em] text-accent uppercase'>
                    {label}
                  </span>
                  <h2 className='font-serif text-xl leading-snug tracking-tight'>
                    {video.title ?? 'Untitled'}
                  </h2>
                  {postSlug ? (
                    <Link
                      href={`/posts/${postSlug}`}
                      className='mt-auto pt-2 font-mono text-xs tracking-wide text-muted uppercase transition-colors hover:text-foreground'
                    >
                      {video.post?.title ?? 'View post'} →
                    </Link>
                  ) : (
                    video.post?.title && (
                      <span className='mt-auto pt-2 font-mono text-xs tracking-wide text-muted uppercase'>
                        {video.post.title}
                      </span>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
