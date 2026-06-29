import { defineLive } from 'next-sanity/live';
import { client } from './sanity.client';

// Live Content API. `sanityFetch` is a drop-in for `client.fetch` that streams
// live updates and, in draft mode, reads drafts (viewer token) with stega on.
// The Viewer token is only needed for draft previews; live updates work without it.
const token = process.env.SANITY_API_READ_TOKEN;

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: token,
  browserToken: token,
});
