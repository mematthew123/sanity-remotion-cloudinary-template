import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  PortableText,
  type PortableTextComponents,
} from '@portabletext/react';
import { client, urlFor, type SanityImageSource } from '@/lib/sanity.client';
import { sanityFetch } from '@/lib/sanity.live';
import { ALL_POSTS_QUERY, SINGLE_POST_QUERY, POST_CAPTIONS_QUERY } from '@/lib/sanity.queries';
import { absoluteUrl } from '@/lib/siteUrl';
import { buildTranscript } from '@/lib/transcript';
import NarratedReadingHero from '@/components/NarratedReadingHero';
import ArticleAudioPlayer from '@/components/ArticleAudioPlayer';
import { AudioPlaybackProvider } from '@/components/AudioPlayback';
import InteractiveTranscript from '@/components/InteractiveTranscript';
import VideoPlayer from '@/components/VideoPlayer';
import FanoutPanel from '@/components/FanoutPanel';
import ProvenancePanel from '@/components/ProvenancePanel';
import VideoJsonLd from '@/components/VideoJsonLd';

export const revalidate = 60;

const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => (
      <h2 className='mt-8 font-serif text-3xl tracking-tight sm:text-4xl'>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className='mt-6 font-serif text-2xl tracking-tight sm:text-3xl'>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className='mt-4 font-serif text-xl tracking-tight'>{children}</h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className='border-l-2 border-accent pl-5 font-serif text-2xl/snug text-foreground/80 italic'>
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
        <div className='relative my-2 aspect-video w-full overflow-hidden rounded-lg bg-muted/10'>
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

export async function generateStaticParams() {
  const posts = await client.fetch(ALL_POSTS_QUERY);
  return posts
    .map((p) => p.slug?.current)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await client.fetch(SINGLE_POST_QUERY, { slug });
  if (!post) return {};

  const title = post.title ?? 'Untitled';
  const description =
    post.excerpt ?? 'A post rendered to video from Sanity content.';
  const url = absoluteUrl(`/posts/${slug}`);

  // Prefer a rendered video's poster (showcases the Cloudinary fan-out powering
  // the social card); fall back to the post's main image.
  const videoPoster = (post.videos ?? [])
    .map((v) => v.posterUrl)
    .find((u): u is string => Boolean(u));
  const ogImage =
    videoPoster ??
    (post.mainImage
      ? urlFor(post.mainImage).width(1200).height(630).fit('crop').url()
      : null);
  const images = ogImage
    ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
    : [];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      images,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function PostPage({
  params,
}: {
  // Next 16: route params are async and must be awaited.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // sanityFetch is live + draft-aware; metadata/generateStaticParams keep the
  // plain client so OG tags never carry stega-encoded strings.
  const { data: post } = await sanityFetch({
    query: SINGLE_POST_QUERY,
    params: { slug },
  });

  if (!post) notFound();

  const mainImageUrl = post.mainImage
    ? urlFor(post.mainImage).width(1200).height(675).fit('crop').url()
    : null;

  // Split videos: the narrated reading gets its own hero treatment (it's
  // long-form with audio, deserves prominence). Teaser videos stay in the grid
  // below the body. Promo videos are intentionally not surfaced on the post page
  // (they're for newsletter/social fanout, not on-page playback).
  const allVideos = post.videos ?? [];
  const narratedReading = allVideos.find((v) => v.template === 'article-narrated') ?? null;
  const shortFormVideos = allVideos.filter(
    (v) => v.template !== 'article-narrated' && v.template !== 'article-promo',
  );

  // The fan-out panel showcases one render's full Cloudinary variant set.
  // Prefer the narrated reading (richest — 5 derivations); otherwise fall back
  // to whatever render the post has so the showcase still appears.
  const fanoutVideo = narratedReading ?? shortFormVideos[0] ?? allVideos[0] ?? null;

  // Narrated readings carry a WebVTT caption track reconstructed from their
  // narration chunks (served by the sibling captions.vtt route).
  const captionsUrl = narratedReading ? `/posts/${slug}/captions.vtt` : null;

  // Interactive read-along transcript: word-timed when alignment has run,
  // paragraph-level otherwise. Only fetched for narrated posts.
  const captions = narratedReading
    ? (await sanityFetch({ query: POST_CAPTIONS_QUERY, params: { slug } })).data
    : null;
  const transcript = captions ? buildTranscript(captions.chunks ?? []) : [];

  return (
    <article className='mx-auto max-w-3xl px-6 py-16'>
      <VideoJsonLd
        videos={allVideos}
        postTitle={post.title ?? 'Untitled'}
        description={post.excerpt ?? 'A post rendered to video from Sanity content.'}
        pageUrl={absoluteUrl(`/posts/${slug}`)}
        fallbackThumbnail={mainImageUrl}
        uploadDate={post.publishedAt}
      />
      <header className='mb-10'>
        <h1 className='font-serif text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl'>
          {post.title ?? 'Untitled'}
        </h1>
        <div className='mt-5 font-mono text-xs tracking-[0.15em] text-muted uppercase'>
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
          <p className='mt-6 font-serif text-2xl/relaxed text-muted italic'>
            {post.excerpt}
          </p>
        )}
      </header>

      {/* Standalone "listen" affordance: the audio-only narration (the
          podcast-mp3 variant of the narrated render), surfaced right under the
          byline so readers can start listening before scrolling. Decoupled from
          the narrated-video hero below — listen here, watch there. */}
      {narratedReading?.podcastUrl && (
        <AudioPlaybackProvider>
          <ArticleAudioPlayer
            src={narratedReading.podcastUrl}
            durationSeconds={narratedReading.duration}
          />
          {transcript.length > 0 && <InteractiveTranscript paragraphs={transcript} />}
        </AudioPlaybackProvider>
      )}

      {/* When a narrated reading exists, surface it instead of (and where) the
          static main image would go. The mainImage doubles as the video's
          poster frame inside the hero. */}
      {narratedReading ? (
        <NarratedReadingHero
          video={narratedReading}
          posterUrl={mainImageUrl}
          captionsUrl={captionsUrl}
        />
      ) : (
        mainImageUrl && (
          <div className='relative mb-10 aspect-video w-full overflow-hidden rounded-xl bg-muted/10 ring-1 ring-foreground/10'>
            <Image
              src={mainImageUrl}
              alt={post.mainImage?.alt ?? post.title ?? ''}
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

      {fanoutVideo && (
        <>
          <ProvenancePanel video={fanoutVideo} />
          <FanoutPanel video={fanoutVideo} />
        </>
      )}
    </article>
  );
}
