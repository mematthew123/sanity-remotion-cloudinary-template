import { defineEnableDraftMode } from 'next-sanity/draft-mode';
import { client } from '@/lib/sanity.client';

// Presentation calls this to turn on draft mode; validates via the viewer token.
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: process.env.SANITY_API_READ_TOKEN }),
});
