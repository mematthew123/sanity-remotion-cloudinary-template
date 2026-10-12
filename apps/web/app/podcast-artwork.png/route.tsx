import { ImageResponse } from 'next/og';
import { ShareCard, loadBrandFonts } from '@/lib/og';
import { FEED_TITLE } from '@/lib/podcast';

const KICKER = 'Podcast';
const BRAND = 'Template';

export async function GET() {
  const fonts = await loadBrandFonts();
  return new ImageResponse(<ShareCard kicker={KICKER} title={FEED_TITLE} brand={BRAND} />, {
    width: 1400,
    height: 1400,
    fonts,
  });
}
