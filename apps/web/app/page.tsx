import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/lib/sanity.client';
import { allPostsQuery } from '@/lib/sanity.queries';

export const revalidate = 60;

export default async function HomePage() {
  const posts = await client.fetch(allPostsQuery);

  return (
    <div className='mx-auto max-w-5xl px-6 py-12'>
      <section className='mb-12'>
        <h1 className='font-mono text-3xl font-extrabold uppercase tracking-tight sm:text-5xl'>
          Sanity → Remotion → Cloudinary
        </h1>
        <p className='mt-4 max-w-2xl text-muted'>
          Render videos from Sanity content with Remotion, publish to this
          Next.js site via Cloudinary — one click from Sanity Studio.
        </p>
        <Link
          href='/videos'
          className='mt-6 inline-block border border-foreground px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background'
        >
          Browse all videos
        </Link>
      </section>

      <h2 className='mb-6 font-mono text-sm font-bold uppercase tracking-wide text-muted'>
        Posts
      </h2>

      {posts.length === 0 ? (
        <p className='text-muted'>Nothing here. Yet.</p>
      ) : (
        <ul className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
          {posts.map((post) => {
            const href = post.slug?.current
              ? `/posts/${post.slug.current}`
              : null;
            const imageUrl = post.mainImageUrl ?? null;
            const card = (
              <article className='flex h-full flex-col border border-foreground/20 transition-colors hover:border-foreground'>
                {imageUrl && (
                  <div className='relative aspect-video w-full overflow-hidden border-b border-foreground/20 bg-muted/10'>
                    <Image
                      src={imageUrl}
                      alt={post.title ?? ''}
                      fill
                      sizes='(max-width: 640px) 100vw, 50vw'
                      className='object-cover'
                    />
                  </div>
                )}
                <div className='flex flex-1 flex-col gap-2 p-5'>
                  <h3 className='font-mono text-lg font-bold'>
                    {post.title ?? 'Untitled'}
                  </h3>
                  {post.excerpt && (
                    <p className='text-sm text-muted'>{post.excerpt}</p>
                  )}
                  <div className='mt-auto pt-2 font-mono text-xs uppercase text-muted'>
                    {post.authorName ?? 'Unknown'}
                    {post.publishedAt && (
                      <>
                        {' · '}
                        <span suppressHydrationWarning>
                          {new Date(post.publishedAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: 'UTC',
                            },
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );

            return (
              <li key={post._id}>
                {href ? <Link href={href}>{card}</Link> : card}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
