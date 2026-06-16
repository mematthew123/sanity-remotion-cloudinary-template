import Link from 'next/link';
import { client } from '@/lib/sanity.client';
import { allVideosQuery } from '@/lib/sanity.queries';
// React-free metadata import — labels and fallback dimensions only.
import { findComposition } from '@template/video-core/registry';

export const revalidate = 60;

export const metadata = {
  title: 'Videos',
  description:
    'Every video rendered from Sanity content with Remotion and served via Cloudinary.',
};

export default async function VideosPage() {
  const videos = await client.fetch(allVideosQuery);
  const playable = videos.filter((v) => v.cloudinaryUrl);

  return (
    <div className='mx-auto max-w-6xl px-6 py-12'>
      <h1 className='mb-2 font-mono text-3xl font-extrabold uppercase tracking-tight'>
        Videos
      </h1>
      <p className='mb-10 text-muted'>
        Rendered with Remotion, served from Cloudinary.
      </p>

      {playable.length === 0 ? (
        <p className='text-muted'>Nothing here. Yet.</p>
      ) : (
        <ul className='grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3'>
          {playable.map((video) => {
            const meta = video.template
              ? findComposition(video.template)
              : undefined;
            const width = video.width ?? meta?.width ?? 1080;
            const height = video.height ?? meta?.height ?? 1080;
            const label = meta?.label ?? video.template ?? 'Video';
            const postSlug = video.post?.slug?.current ?? null;

            return (
              <li
                key={video._id}
                className='flex flex-col border border-foreground/20'
              >
                <div className='border-b border-foreground/20 bg-foreground'>
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
                <div className='flex flex-1 flex-col gap-2 p-4'>
                  <span className='font-mono text-xs font-bold uppercase tracking-wide text-accent'>
                    {label}
                  </span>
                  <h2 className='font-mono text-sm font-bold'>
                    {video.title ?? 'Untitled'}
                  </h2>
                  {postSlug ? (
                    <Link
                      href={`/posts/${postSlug}`}
                      className='mt-auto pt-2 font-mono text-xs uppercase text-muted hover:text-foreground'
                    >
                      {video.post?.title ?? 'View post'} →
                    </Link>
                  ) : (
                    video.post?.title && (
                      <span className='mt-auto pt-2 font-mono text-xs uppercase text-muted'>
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
