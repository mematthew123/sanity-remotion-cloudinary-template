import { ImageResponse } from 'next/og';
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  ShareCard,
  loadBrandFonts,
} from '@/lib/og';

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
  const fonts = await loadBrandFonts();

  return new ImageResponse(
    <ShareCard kicker={KICKER} title={TITLE} brand={BRAND} />,
    { ...size, fonts },
  );
}
