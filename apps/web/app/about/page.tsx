import type { Metadata } from 'next';
import Image from 'next/image';

// ─── Edit me ─────────────────────────────────────────────────────────────────
// Personal copy lives here so the layout below stays untouched. Swap these for
// your own details, then drop your headshot at apps/web/public/me.jpg (or change
// PHOTO_SRC below).
const NAME = 'Your Name';
const ROLE = 'Designer & developer';
const PHOTO_SRC = '/me.jpg';
const PHOTO_ALT = 'Portrait of Your Name';

// The "Work with me" CTA points at the agency (Fortivex). Set the address you
// want enquiries to land in.
const WORK_EMAIL = 'hello@fortivex.com'; // TODO: real Fortivex inbox
const WORK_SUBJECT = 'Project enquiry via renderonce.dev';

// Each string is its own paragraph.
const BIO: string[] = [
  'I build content-to-video pipelines — the kind of system that turns a piece of writing into a finished, distributable video without anyone touching a timeline.',
  'This template is one of those systems, made in partnership with Sanity and Cloudinary: author in the Studio, render once with Remotion, and let Cloudinary fan that single asset out to every surface.',
  'I work through Fortivex, where I take on a small number of build engagements at a time — from one-off pipelines like this to full production systems.',
];
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'About',
  description: `Built by ${NAME} — ${ROLE}.`,
};

export default function AboutPage() {
  const mailto = `mailto:${WORK_EMAIL}?subject=${encodeURIComponent(WORK_SUBJECT)}`;

  return (
    <div className='mx-auto max-w-5xl px-6 py-20'>
      <section className='grid grid-cols-1 gap-12 sm:grid-cols-[280px_1fr] sm:items-start'>
        <div className='relative aspect-square w-full overflow-hidden rounded-xl bg-muted/10'>
          <Image
            src={PHOTO_SRC}
            alt={PHOTO_ALT}
            fill
            sizes='(max-width: 640px) 100vw, 280px'
            className='object-cover'
            priority
          />
        </div>

        <div>
          <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
            Built by
          </span>
          <h1 className='mt-4 font-serif text-5xl leading-[1.05] tracking-tight'>
            {NAME}
          </h1>
          <p className='mt-3 font-serif text-xl text-muted italic'>{ROLE}</p>

          <div className='mt-8 max-w-prose space-y-5 leading-relaxed text-muted'>
            {BIO.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <a
            href={mailto}
            className='group mt-10 inline-flex items-center gap-2 rounded-full border border-foreground/30 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background'
          >
            <span>Work with me</span>
            <span className='transition-transform group-hover:translate-x-1'>→</span>
          </a>
        </div>
      </section>
    </div>
  );
}
