import { createClient } from 'next-sanity';
import imageUrlBuilder from '@sanity/image-url';

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

const builder = imageUrlBuilder(client);

// Derived from the builder so we don't depend on a deep internal import path
// from @sanity/image-url (which isn't exposed under `bundler` resolution).
export type SanityImageSource = Parameters<typeof builder.image>[0];

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
