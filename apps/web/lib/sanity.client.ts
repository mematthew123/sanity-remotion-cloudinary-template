import { createClient } from 'next-sanity';
import imageUrlBuilder from '@sanity/image-url';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-12-27',
  useCdn: true,
  perspective: 'published',
});

const builder = imageUrlBuilder(client);

// Derived from the builder so we don't depend on a deep internal import path
// from @sanity/image-url (which isn't exposed under `bundler` resolution).
export type SanityImageSource = Parameters<typeof builder.image>[0];

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
