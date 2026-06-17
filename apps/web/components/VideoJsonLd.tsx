import type { PostVideo } from '@/lib/sanity.queries';

// Emits schema.org/VideoObject JSON-LD so each rendered video is first-class,
// indexable content (Google video results, AI answer engines). Rendered videos
// authored from CMS content being SEO-native is a core part of the template's
// pitch — this is what makes that true.

/** Seconds → ISO 8601 duration (e.g. 95 → "PT1M35S"), per schema.org. */
function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m > 0 ? `${m}M` : ''}${s}S`;
}

interface Props {
  videos: PostVideo[];
  postTitle: string;
  description: string;
  pageUrl: string;
  /** Fallback thumbnail (the post's main image) when a video has no poster. */
  fallbackThumbnail?: string | null;
  uploadDate?: string | null;
}

export default function VideoJsonLd({
  videos,
  postTitle,
  description,
  pageUrl,
  fallbackThumbnail,
  uploadDate,
}: Props) {
  const objects = videos
    .filter((v) => v.cloudinaryUrl)
    .map((v) => {
      const thumb = v.posterUrl ?? fallbackThumbnail ?? undefined;
      return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: v.title ?? postTitle,
        description,
        ...(thumb ? { thumbnailUrl: [thumb] } : {}),
        uploadDate: v.renderedAt ?? uploadDate ?? undefined,
        duration: isoDuration(v.duration),
        contentUrl: v.cloudinaryUrl ?? undefined,
        embedUrl: pageUrl,
      };
    });

  if (objects.length === 0) return null;

  return (
    <>
      {objects.map((obj, i) => (
        <script
          key={i}
          type='application/ld+json'
          // Server-rendered static JSON — safe; no user-controlled HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </>
  );
}
