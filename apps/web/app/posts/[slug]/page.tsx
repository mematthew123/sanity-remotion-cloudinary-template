import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  PortableText,
  type PortableTextBlock,
  type PortableTextComponents,
} from '@portabletext/react';
import { client, urlFor, type SanityImageSource } from '@/lib/sanity.client';
import {
  allPostsQuery,
  singlePostQuery,
  type Video,
} from '@/lib/sanity.queries';
import NarratedReadingHero from '@/components/NarratedReadingHero';
import VideoPlayer from '@/components/VideoPlayer';

export const revalidate = 60;

const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => (
      <h2 className='mt-6 font-mono text-2xl font-extrabold uppercase tracking-tight sm:text-3xl'>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className='mt-4 font-mono text-xl font-bold uppercase tracking-tight sm:text-2xl'>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className='mt-4 font-mono text-lg font-bold uppercase tracking-tight'>
        {children}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className='border-l-4 border-foreground pl-4 font-serif text-xl italic text-muted'>
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className='list-disc space-y-1 pl-6'>{children}</ul>
    ),
    number: ({ children }) => (
      <ol className='list-decimal space-y-1 pl-6'>{children}</ol>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className='font-bold'>{children}</strong>,
    em: ({ children }) => <em className='italic'>{children}</em>,
    link: ({ value, children }) => {
      const href = (value as { href?: string } | undefined)?.href ?? '#';
      const external = /^https?:\/\//.test(href);
      return (
        <Link
          href={href}
          {...(external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          className='underline decoration-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground'
        >
          {children}
        </Link>
      );
    },
  },
  types: {
    image: ({ value }) => {
      const src = urlFor(value as SanityImageSource)
        .width(1600)
        .url();
      return (
        <div className='relative my-2 aspect-video w-full overflow-hidden border border-foreground/20 bg-muted/10'>
          <Image
            src={src}
            alt={(value as { alt?: string } | undefined)?.alt ?? ''}
            fill
            sizes='(max-width: 768px) 100vw, 768px'
            className='object-cover'
          />
        </div>
      );
    },
  },
};

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

  // Split videos: the narrated reading gets its own hero treatment (it's
  // long-form with audio, deserves prominence). Short-form promo/teaser stay
  // in the existing grid below the body.
  const allVideos = post.videos ?? [];
  const narratedReading = allVideos.find((v) => v.template === 'article-narrated') ?? null;
  const shortFormVideos = allVideos.filter((v) => v.template !== 'article-narrated');

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

      {/* When a narrated reading exists, surface it instead of (and where) the
          static main image would go. The mainImage doubles as the video's
          poster frame inside the hero. */}
      {narratedReading ? (
        <NarratedReadingHero video={narratedReading} posterUrl={mainImageUrl} />
      ) : (
        mainImageUrl && (
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
        )
      )}

      {post.body && post.body.length > 0 && (
        <div className='prose-template flex flex-col gap-4 leading-relaxed'>
          <PortableText value={post.body} components={portableTextComponents} />
        </div>
      )}

      <VideoPlayer videos={shortFormVideos} />
    </article>
  );
}
