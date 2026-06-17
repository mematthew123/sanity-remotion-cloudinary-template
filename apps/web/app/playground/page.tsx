import { client } from '@/lib/sanity.client';
import { PLAYGROUND_VIDEOS_QUERY } from '@/lib/sanity.queries';
import TransformPlayground from '@/components/TransformPlayground';

export const revalidate = 60;

export const metadata = {
  title: 'Transform Playground',
  description:
    'Derive any format from a single rendered video, live, with Cloudinary transformations.',
};

export default async function PlaygroundPage() {
  // Server-only env — passed to the client component as a prop so the cloud
  // name never needs a NEXT_PUBLIC_* mirror.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';
  const videos = (await client.fetch(PLAYGROUND_VIDEOS_QUERY)).filter(
    (v) => v.cloudinaryPublicId,
  );

  return (
    <div className='mx-auto max-w-5xl px-6 py-20'>
      <header className='mb-14 border-b border-foreground/10 pb-10'>
        <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
          One render · infinite derivations
        </span>
        <h1 className='mt-4 font-serif text-5xl tracking-tight'>
          Transform playground
        </h1>
        <p className='mt-4 max-w-xl font-serif text-xl/relaxed text-muted italic'>
          Every derivation below is computed by Cloudinary from the same
          canonical MP4 — change the transformation and the CDN renders it on the
          fly. No re-render, no re-upload.
        </p>
      </header>

      {!cloudName ? (
        <p className='text-muted'>
          Set <code className='font-mono'>CLOUDINARY_CLOUD_NAME</code> to enable
          the playground.
        </p>
      ) : videos.length === 0 ? (
        <p className='text-muted'>
          No rendered videos yet — render one from Sanity Studio to start
          transforming.
        </p>
      ) : (
        <TransformPlayground cloudName={cloudName} videos={videos} />
      )}
    </div>
  );
}
