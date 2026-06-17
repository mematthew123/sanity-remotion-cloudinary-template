import type { MetadataRoute } from 'next';
import { client } from '@/lib/sanity.client';
import { SITEMAP_QUERY } from '@/lib/sanity.queries';
import { SITE_URL, absoluteUrl } from '@/lib/siteUrl';

// Sitemap with the Google video extension: each post that has a ready render
// carries a <video> entry (thumbnail + content URL) so rendered videos are
// discoverable as video results, not just pages.

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await client.fetch(SITEMAP_QUERY);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/videos'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/playground'), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => p.slug)
    .map((p) => {
      const entry: MetadataRoute.Sitemap[number] = {
        url: absoluteUrl(`/posts/${p.slug}`),
        lastModified: p._updatedAt ?? undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
      };
      // Video sitemap extension — requires a thumbnail, so only when the poster
      // variant exists.
      if (p.video?.cloudinaryUrl && p.video.posterUrl) {
        entry.videos = [
          {
            title: p.video.title ?? p.title ?? 'Video',
            thumbnail_loc: p.video.posterUrl,
            description: p.excerpt ?? p.title ?? 'Rendered video.',
            content_loc: p.video.cloudinaryUrl,
          },
        ];
      }
      return entry;
    });

  return [...staticRoutes, ...postRoutes];
}
