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
      renderedAt
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
  post?: {
    title: string | null;
    slug: { current: string } | null;
  } | null;
};
