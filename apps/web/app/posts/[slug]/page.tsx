import Image from 'next/image';
import { notFound } from 'next/navigation';
import { PortableText, type PortableTextBlock } from '@portabletext/react';
import { client, urlFor, type SanityImageSource } from '@/lib/sanity.client';
import {
  allPostsQuery,
  singlePostQuery,
  type Video,
} from '@/lib/sanity.queries';
import VideoPlayer from '@/components/VideoPlayer';

export const revalidate = 60;

type Post = {
  _id: string;
  title: string | null;
  slug: { current: string } | null;
  publishedAt: string | null;
  excerpt: string | null;
  body: PortableTextBlock[] | null;
  authorName: string | null;
  authorImageUrl: string | null;
  mainImage: SanityImageSource | null;
  videos: Video[] | null;
};

export async function generateStaticParams() {
  const posts = await client.fetch<{ slug: { current: string } | null }[]>(
    allPostsQuery,
  );
  return posts
    .map((p) => p.slug?.current)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export default async function PostPage({
  params,
}: {
  // Next 16: route params are async and must be awaited.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await client.fetch<Post | null>(singlePostQuery, { slug });

  if (!post) notFound();

  const mainImageUrl = post.mainImage
    ? urlFor(post.mainImage).width(1200).height(675).fit('crop').url()
    : null;

  return (
    <article className='mx-auto max-w-3xl px-6 py-12'>
      <header className='mb-8'>
        <h1 className='font-mono text-3xl font-extrabold uppercase tracking-tight sm:text-4xl'>
          {post.title ?? 'Untitled'}
        </h1>
        <div className='mt-3 font-mono text-xs uppercase text-muted'>
          {post.authorName ?? 'Unknown'}
          {post.publishedAt && (
            <>
              {' · '}
              <span suppressHydrationWarning>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </span>
            </>
          )}
        </div>
        {post.excerpt && (
          <p className='mt-4 font-serif text-xl italic text-muted'>
            {post.excerpt}
          </p>
        )}
      </header>

      {mainImageUrl && (
        <div className='relative mb-10 aspect-video w-full overflow-hidden border border-foreground bg-muted/10'>
          <Image
            src={mainImageUrl}
            alt={post.title ?? ''}
            fill
            sizes='(max-width: 768px) 100vw, 768px'
            className='object-cover'
            priority
          />
        </div>
      )}

      {post.body && post.body.length > 0 && (
        <div className='prose-template flex flex-col gap-4 leading-relaxed'>
          <PortableText value={post.body} />
        </div>
      )}

      <VideoPlayer videos={post.videos ?? []} />
    </article>
  );
}
