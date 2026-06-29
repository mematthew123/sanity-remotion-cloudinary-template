// "How this was made" — the pipeline behind one render, made legible:
// Sanity post → Remotion composition → Cloudinary variants. A showcase template
// should explain its own magic; this is the one-glance version.
//
// Server component. Imports only the React-free registry metadata.
import { stegaClean } from 'next-sanity';
import { findComposition } from '@template/video-core/registry';
import type { PostVideo } from '@/lib/sanity.queries';

function formatElapsed(startedAt?: string | null, endedAt?: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function ProvenancePanel({ video }: { video: PostVideo }) {
  // stegaClean before the registry key lookup — stega chars (present in draft
  // mode) would miss the COMPOSITIONS_BY_ID key and drop all the derived metadata.
  const template = stegaClean(video.template);
  const meta = template ? findComposition(template) : undefined;
  const fps = meta?.fps ?? 30;
  const frames = video.duration
    ? Math.round(video.duration * fps)
    : meta?.defaultDurationFrames;
  const width = video.width ?? meta?.width;
  const height = video.height ?? meta?.height;
  const resolution = width && height ? `${width}×${height}` : null;
  const variantCount = (video.variants ?? []).filter((v) => v.url).length;
  const elapsed = formatElapsed(video.renderStartedAt, video.renderedAt);

  const steps: { tool: string; title: string; lines: string[] }[] = [
    {
      tool: 'Sanity',
      title: 'Authored as content',
      lines: ['Structured post', 'Edited in Studio'],
    },
    {
      tool: 'Remotion',
      title: meta?.label ?? video.template ?? 'Composition',
      lines: [
        `${fps}fps${frames ? ` · ${frames} frames` : ''}`,
        [resolution, elapsed ? `rendered in ${elapsed}` : null]
          .filter(Boolean)
          .join(' · '),
      ].filter(Boolean),
    },
    {
      tool: 'Cloudinary',
      title: `${variantCount} derivation${variantCount === 1 ? '' : 's'}`,
      lines: ['One canonical MP4', 'No re-encodes'],
    },
  ];

  return (
    <section className='mt-14 border-t border-foreground/10 pt-10'>
      <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
        How this was made
      </span>
      <ol className='mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-foreground/10 sm:grid-cols-3'>
        {steps.map((step) => (
          <li key={step.tool} className='bg-background p-5'>
            <div className='font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase'>
              {step.tool}
            </div>
            <div className='mt-2 font-serif text-lg tracking-tight'>
              {step.title}
            </div>
            <div className='mt-1 space-y-0.5 text-sm text-muted'>
              {step.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
