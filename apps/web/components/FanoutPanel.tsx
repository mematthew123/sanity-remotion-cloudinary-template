import type { PostVideo } from '@/lib/sanity.queries';

// "One render, delivered N ways" — the explicit fan-out showcase. Reads a
// video's Cloudinary `variants[]` (derivations of the single canonical MP4, not
// re-renders) and lists each one as a real, openable deliverable. This is the
// most direct on-site demonstration of the render-once → fan-out pipeline.
//
// Server component: pure presentation over already-resolved variant URLs.

type Variant = NonNullable<PostVideo['variants']>[number];

// Per-variant copy + behaviour. Labels intentionally mirror the registry's
// VariantDef labels; the blurb explains what each derivation is *for*.
const PRESENTATION: Record<
  string,
  { label: string; blurb: string; download?: boolean }
> = {
  'site-mp4': {
    label: 'Site MP4',
    blurb: 'Adaptive codec & quality, chosen per device',
  },
  'site-poster-jpg': {
    label: 'Poster',
    blurb: 'Still frame for thumbnails & social cards',
  },
  'site-preview-gif': {
    label: 'Preview GIF',
    blurb: 'Silent 3-second loop for hovers & email',
  },
  'youtube-1080p-mp4': {
    label: 'YouTube 1080p',
    blurb: 'Full-resolution master, ready to upload',
    download: true,
  },
  'podcast-mp3': {
    label: 'Podcast MP3',
    blurb: 'Audio-only extraction for podcast feeds',
    download: true,
  },
};

function specFor(v: Variant): string {
  const fmt = (v.format ?? '').toUpperCase();
  if (v.width && v.height) return `${fmt} · ${v.width}×${v.height}`;
  if (v.format === 'mp3') return `${fmt} · audio`;
  if (v.variantId === 'site-mp4') return `${fmt} · adaptive`;
  return fmt;
}

export default function FanoutPanel({ video }: { video: PostVideo }) {
  const variants = (video.variants ?? []).filter((v) => v.url);
  if (variants.length < 2) return null;

  return (
    <section className='mt-14 border-t border-foreground/10 pt-10'>
      <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
        Render once · fan out
      </span>
      <h2 className='mt-3 font-serif text-3xl tracking-tight'>
        One render, delivered {variants.length} ways
      </h2>
      <p className='mt-3 max-w-xl leading-relaxed text-muted'>
        Every format below is a Cloudinary derivation of the same canonical
        render — no re-encoding the video, no second render job.
      </p>

      <ul className='mt-8 flex flex-col'>
        {variants.map((v, i) => {
          const p = v.variantId ? PRESENTATION[v.variantId] : undefined;
          const label = p?.label ?? v.variantId ?? 'Variant';
          return (
            <li
              key={v.variantId ?? i}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 ${
                i !== 0 ? 'border-t border-foreground/10' : ''
              }`}
            >
              <span className='w-36 shrink-0 font-serif text-lg tracking-tight'>
                {label}
              </span>
              <span className='min-w-0 flex-1 text-sm text-muted'>
                {p?.blurb}
              </span>
              <span className='font-mono text-[0.7rem] tracking-[0.15em] text-muted/80 uppercase'>
                {specFor(v)}
              </span>
              <a
                href={v.url!}
                {...(p?.download
                  ? { download: true }
                  : { target: '_blank', rel: 'noopener noreferrer' })}
                className='group inline-flex items-center gap-1.5 font-mono text-xs tracking-wide text-foreground/70 uppercase transition-colors hover:text-accent'
              >
                {p?.download ? 'Download' : 'Open'}
                <span className='transition-transform group-hover:translate-x-0.5'>
                  {p?.download ? '↓' : '↗'}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
