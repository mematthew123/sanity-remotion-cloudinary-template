import { defineQuery } from 'next-sanity';

// All published posts, newest first. `mainImageUrl` and `authorName` are
// flattened so list views don't need image-url / reference resolution.
export const allPostsQuery = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc){
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    "mainImageUrl": mainImage.asset->url,
    "authorName": author->name
  }
`);

// A single post plus its ready videos (back-referenced — the video doc points
// at the post via `post`, the post does not hold a videos[] array).
export const singlePostQuery = defineQuery(/* groq */ `
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
      renderedAt,
      "podcastUrl": variants[variantId == "podcast-mp3"][0].url
    }
  }
`);

// Every ready video across the site, with a light reference back to its post.
export const allVideosQuery = defineQuery(/* groq */ `
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
    "post": post->{title, slug}
  }
`);

/**
 * Shape of a single video as projected by the queries above. There is no
 * generated types file in this template, so this is the hand-written contract
 * the UI relies on. Uses the raw `cloudinaryUrl` — no variant/transform system.
 */
export type Video = {
  _id: string;
  title: string | null;
  template: string | null;
  format: 'mp4' | 'gif' | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  cloudinaryUrl: string | null;
  cloudinaryPublicId: string | null;
  renderedAt: string | null;
  // Audio-only podcast derivation (podcast-mp3), projected for the narrated
  // reading on the post page. Only the singlePostQuery projects it.
  podcastUrl?: string | null;
  post?: {
    title: string | null;
    slug: { current: string } | null;
  } | null;
};

// Loads a newsletter doc with its hero video (variant URLs flattened to the top
// of the video projection) plus the optional linked post used for the CTA.
// Used by /api/newsletter/{preview,send}. The send route reads `_rev` for the
// optimistic-concurrency guard on the draft→sending transition.
// Shared projection for both query variants below — keeps the shape identical.
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
  video->{
    _id,
    title,
    cloudinaryPublicId,
    status,
    "gifUrl": variants[variantId == "site-preview-gif"][0].url,
    "posterUrl": variants[variantId == "site-poster-jpg"][0].url
  },
  post->{
    title,
    excerpt,
    "slug": slug.current,
    publishedAt,
    "authorName": author->name
  }
}`;

// Used by /api/newsletter/preview — relies on `perspective: 'drafts'` to find
// the in-progress doc. _id may be rewritten to the base form by the perspective.
export const newsletterByIdQuery = defineQuery(/* groq */ `
  *[_type == "newsletter" && _id == $id][0]${NEWSLETTER_PROJECTION}
`);

// Used by /api/newsletter/send under `perspective: 'raw'`. Returns the actual
// storage _id (drafts.X or X) so the ifRevisionID patch targets the right doc.
// Order by _updatedAt so the draft (newer) wins when both exist.
export const newsletterByEitherIdQuery = defineQuery(/* groq */ `
  *[_type == "newsletter" && _id in [$draftId, $baseId]] | order(_updatedAt desc)[0]${NEWSLETTER_PROJECTION}
`);

export type NewsletterForSend = {
  _id: string;
  _rev: string;
  title: string | null;
  subject: string | null;
  previewText: string | null;
  intro: unknown[] | null;
  recipientSelection: {
    selectionType: 'test' | 'audience' | null;
    testEmails: string[] | null;
  } | null;
  status: 'draft' | 'sending' | 'sent' | 'failed' | null;
  sentAt: string | null;
  recipientCount: number | null;
  resendBroadcastId: string | null;
  video: {
    _id: string;
    title: string | null;
    cloudinaryPublicId: string | null;
    status: string | null;
    gifUrl: string | null;
    posterUrl: string | null;
  } | null;
  post: {
    title: string | null;
    excerpt: string | null;
    slug: string | null;
    publishedAt: string | null;
    authorName: string | null;
  } | null;
};
