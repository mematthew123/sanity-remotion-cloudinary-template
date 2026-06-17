import { client } from '@/lib/sanity.client';
import { PODCAST_FEED_QUERY } from '@/lib/sanity.queries';
import { SITE_URL, absoluteUrl } from '@/lib/siteUrl';

// RSS 2.0 + iTunes podcast feed over the `podcast-mp3` fan-out variant. Turns
// the audio derivation of every narrated render into a real, subscribable
// channel — the "podcast" surface as an actual endpoint, not a download button.

export const revalidate = 300;

const FEED_TITLE = 'Narrated Readings';
const FEED_DESCRIPTION =
  'Audio narrations of every article, extracted from the rendered video.';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Seconds → HH:MM:SS for <itunes:duration>. */
function clock(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export async function GET() {
  const episodes = await client.fetch(PODCAST_FEED_QUERY);
  const feedUrl = absoluteUrl('/feed.xml');

  const items = episodes
    .filter((e) => e.audioUrl)
    .map((e) => {
      const link = e.post?.slug
        ? absoluteUrl(`/posts/${e.post.slug}`)
        : SITE_URL;
      const title = e.post?.title ?? e.title ?? 'Untitled';
      const summary = e.post?.excerpt ?? title;
      const pubDate = new Date(e.renderedAt ?? 0).toUTCString();
      return [
        '    <item>',
        `      <title>${esc(title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="false">${esc(e._id)}</guid>`,
        `      <description>${esc(summary)}</description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <enclosure url="${esc(e.audioUrl!)}" length="0" type="audio/mpeg" />`,
        `      <itunes:duration>${clock(e.duration)}</itunes:duration>`,
        `      <itunes:summary>${esc(summary)}</itunes:summary>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(FEED_TITLE)}</title>
    <link>${esc(SITE_URL)}</link>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <itunes:explicit>false</itunes:explicit>
    <itunes:summary>${esc(FEED_DESCRIPTION)}</itunes:summary>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
