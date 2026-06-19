import { ImageResponse } from 'next/og';
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  ShareCard,
  loadBrandFonts,
} from '@/lib/og';
import { SITE_URL } from '@/lib/siteUrl';

/**
 * Site-wide default share card — Next applies it to every route without its own
 * `opengraph-image`. See lib/og.tsx for the card.
 */

export const alt = 'Sanity + Remotion + Cloudinary Template';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const KICKER = 'Sanity · Remotion · Cloudinary';
const TITLE = 'Render once. Publish everywhere.';
const BRAND = 'Template';

export default async function OpengraphImage() {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  const fonts = await loadBrandFonts(KICKER + TITLE + BRAND + host);

  return new ImageResponse(
    <ShareCard kicker={KICKER} title={TITLE} brand={BRAND} />,
    { ...size, fonts },
  );
}
