import { defineQuery } from 'next-sanity';
import type {
  ALL_POSTS_QUERY_RESULT,
  SINGLE_POST_QUERY_RESULT,
  ALL_VIDEOS_QUERY_RESULT,
  PODCAST_FEED_QUERY_RESULT,
  SITEMAP_QUERY_RESULT,
  PLAYGROUND_VIDEOS_QUERY_RESULT,
  NEWSLETTER_BY_EITHER_ID_QUERY_RESULT,
  WELCOME_EMAIL_QUERY_RESULT,
} from '@/sanity.types';

// Shared projection: the full Cloudinary variant set on a video doc.
const VIDEO_VARIANTS_PROJECTION = /* groq */ `
  variants[]{variantId, surface, format, url, width, height}
`;

// All published posts, newest first. `mainImage` stays a full image object for
// urlFor() sizing; `authorName` is flattened. The `preview` sub-object pulls
// the newest ready render's GIF + poster so the feed can animate a card on hover.
export const ALL_POSTS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc){
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage,
    "authorName": author->name,
    "preview": *[_type == "video" && post._ref == ^._id && status == "ready" && defined(cloudinaryUrl)] | order(renderedAt desc)[0]{
      "previewGifUrl": variants[variantId == "site-preview-gif"][0].url,
      "posterUrl": variants[variantId == "site-poster-jpg"][0].url
    }
  }
`);

// A single post plus its ready videos (back-referenced; the post holds no
// videos[] array).
export const SINGLE_POST_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    body,
    "authorName": author->name,
    "authorImageUrl": author->image.asset->url,
    mainImage,
    "videos": *[_type == "video" && post._ref == ^._id && status == "ready" && defined(cloudinaryUrl)] | order(renderedAt desc){
      _id,
      title,
      template,
      format,
      duration,
      width,
      height,
      cloudinaryUrl,
      cloudinaryPublicId,
      renderStartedAt,
      renderedAt,
      "podcastUrl": variants[variantId == "podcast-mp3"][0].url,
      "posterUrl": variants[variantId == "site-poster-jpg"][0].url,
      "youtubeUrl": variants[variantId == "youtube-1080p-mp4"][0].url,
      "siteMp4Url": variants[variantId == "site-mp4"][0].url,
      ${VIDEO_VARIANTS_PROJECTION}
    }
  }
`);

// Every ready video across the site, with a light reference back to its post.
export const ALL_VIDEOS_QUERY = defineQuery(/* groq */ `
  *[_type == "video" && status == "ready" && defined(cloudinaryUrl)] | order(renderedAt desc){
    _id,
    title,
    template,
    format,
    duration,
    width,
    height,
    cloudinaryUrl,
    cloudinaryPublicId,
    renderedAt,
    "posterUrl": variants[variantId == "site-poster-jpg"][0].url,
    "previewGifUrl": variants[variantId == "site-preview-gif"][0].url,
    "siteMp4Url": variants[variantId == "site-mp4"][0].url,
    ${VIDEO_VARIANTS_PROJECTION},
    "post": post->{title, slug}
  }
`);

/**
 * View types are derived from TypeGen output (`pnpm typegen`) so they can't
 * drift from the projections above. Don't hand-edit — change the query and
 * re-run typegen.
 */
export type PostListItem = ALL_POSTS_QUERY_RESULT[number];
export type SinglePost = NonNullable<SINGLE_POST_QUERY_RESULT>;

// A post's ready video from `SINGLE_POST_QUERY` (carries `podcastUrl`; no post
// back-ref).
export type PostVideo = SinglePost['videos'][number];

// A ready video from `ALL_VIDEOS_QUERY` (light post back-ref; no `podcastUrl`).
export type VideoListItem = ALL_VIDEOS_QUERY_RESULT[number];

// ── Podcast feed ────────────────────────────────────────────────────────────
// Narrated readings with a podcast-mp3 variant, newest first. Drives the RSS
// feed at /feed.xml.
export const PODCAST_FEED_QUERY = defineQuery(/* groq */ `
  *[_type == "video" && template == "article-narrated" && status == "ready" && count(variants[variantId == "podcast-mp3"]) > 0] | order(renderedAt desc){
    _id,
    title,
    duration,
    renderedAt,
    "audioUrl": variants[variantId == "podcast-mp3"][0].url,
    "post": post->{title, excerpt, "slug": slug.current}
  }
`);
export type PodcastFeedItem = PODCAST_FEED_QUERY_RESULT[number];

// ── Sitemap ─────────────────────────────────────────────────────────────────
// Every post with its primary ready video, for the video-sitemap on
// /sitemap.xml.
export const SITEMAP_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc){
    "slug": slug.current,
    title,
    excerpt,
    publishedAt,
    _updatedAt,
    "video": *[_type == "video" && post._ref == ^._id && status == "ready" && defined(cloudinaryUrl)] | order(renderedAt desc)[0]{
      title,
      cloudinaryUrl,
      "posterUrl": variants[variantId == "site-poster-jpg"][0].url
    }
  }
`);
export type SitemapEntry = SITEMAP_QUERY_RESULT[number];

// ── Captions ────────────────────────────────────────────────────────────────
// Narration chunks for one post — text, duration, and per-word timings that
// build the WebVTT cues at /posts/<slug>/captions.vtt.
export const POST_CAPTIONS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && slug.current == $slug][0]{
    "chunks": voiceoverChunks[]{text, durationSeconds, words[]{text, start, end}}
  }
`);

// ── Playground ──────────────────────────────────────────────────────────────
// A handful of ready renders to seed the public Cloudinary transform playground.
export const PLAYGROUND_VIDEOS_QUERY = defineQuery(/* groq */ `
  *[_type == "video" && status == "ready" && defined(cloudinaryPublicId)] | order(renderedAt desc)[0...12]{
    _id,
    title,
    template,
    width,
    height,
    cloudinaryPublicId
  }
`);
export type PlaygroundVideo = PLAYGROUND_VIDEOS_QUERY_RESULT[number];

// Shared hero-video sub-projection for email surfaces (newsletter + welcome).
// Both embed `site-preview-gif` (poster fallback) as the hero, so URL
// resolution lives in one place.
const EMAIL_HERO_VIDEO_PROJECTION = /* groq */ `video->{
    _id,
    title,
    cloudinaryPublicId,
    status,
    "gifUrl": variants[variantId == "site-preview-gif"][0].url,
    "posterUrl": variants[variantId == "site-poster-jpg"][0].url
  }`;

// Shared projection for both newsletter query variants — keeps the shape
// identical. The send route reads `_rev` for its draft→sending concurrency guard.
const NEWSLETTER_PROJECTION = /* groq */ `{
  _id,
  _rev,
  title,
  subject,
  previewText,
  intro,
  recipientSelection,
  status,
  sentAt,
  recipientCount,
  resendBroadcastId,
  ${EMAIL_HERO_VIDEO_PROJECTION},
  post->{
    title,
    excerpt,
    "slug": slug.current,
    publishedAt,
    "authorName": author->name
  }
}`;

// Used by /api/newsletter/preview under `perspective: 'drafts'` to find the
// in-progress doc.
export const NEWSLETTER_BY_ID_QUERY = defineQuery(/* groq */ `
  *[_type == "newsletter" && _id == $id][0]${NEWSLETTER_PROJECTION}
`);

// Used by /api/newsletter/send under `perspective: 'raw'`. Returns the storage
// _id (drafts.X or X) so the ifRevisionID patch targets the right doc; the
// draft (newer by _updatedAt) wins when both exist.
export const NEWSLETTER_BY_EITHER_ID_QUERY = defineQuery(/* groq */ `
  *[_type == "newsletter" && _id in [$draftId, $baseId]] | order(_updatedAt desc)[0]${NEWSLETTER_PROJECTION}
`);

// Both newsletter queries share NEWSLETTER_PROJECTION, so the result types are
// identical — pick either.
export type NewsletterForSend = NonNullable<NEWSLETTER_BY_EITHER_ID_QUERY_RESULT>;

// The welcome-email singleton (id "welcomeEmail"): the confirmation email and
// the GIF-hero welcome email for the public signup flow. Read token-free by the
// subscribe/confirm routes; the Studio preview reads it under `drafts`.
export const WELCOME_EMAIL_QUERY = defineQuery(/* groq */ `
  *[_id == "welcomeEmail"][0]{
    enabled,
    subject,
    previewText,
    intro,
    confirmationSubject,
    confirmationBody,
    ${EMAIL_HERO_VIDEO_PROJECTION},
    post->{
      title,
      excerpt,
      "slug": slug.current
    }
  }
`);

export type WelcomeEmail = NonNullable<WELCOME_EMAIL_QUERY_RESULT>;
