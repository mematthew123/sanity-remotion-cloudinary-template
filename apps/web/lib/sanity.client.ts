import { createClient } from 'next-sanity';
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-12-27',
  useCdn: true,
  perspective: 'published',
  // Where stega click-to-edit overlays link. Encoding is only turned on per-fetch
  // by `sanityFetch` in draft mode (sanity.live.ts), so this is inert for published reads.
  stega: {
    studioUrl:
      process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ?? 'http://localhost:3333',
  },
});

const builder = createImageUrlBuilder(client);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

export function postImageUrl(
  post: { mainImage?: SanityImageSource | null; preview?: { posterUrl?: string | null } | null },
  width: number,
  height: number,
): string | null {
  return post.mainImage
    ? urlFor(post.mainImage).width(width).height(height).fit('crop').url()
    : (post.preview?.posterUrl ?? null);
}
