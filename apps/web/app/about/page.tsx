import type { Metadata } from 'next';
import Image from 'next/image';
import {
  GITHUB_REPO_URL,
  FORTIVEX_URL,
  FORTIVEX_INTAKE_URL,
  SANITY_MIGRATIONS_URL,
  ZEPHYR_PIXELS_URL,
} from '@/lib/links';

// Headshot: drop the file at apps/web/public/me.jpg (or change PHOTO_SRC).
const PHOTO_SRC = '/me.jpg';
const PHOTO_ALT = 'Matthew Rhoads';

export const metadata: Metadata = {
  title: 'About',
  description:
    'RenderOnce is built by Matthew Rhoads, a Sanity specialist, in partnership with Fortivex.',
};

// Inline link styled to match the site's understated underline treatment.
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noreferrer'
      className='border-b border-foreground/30 pb-0.5 text-foreground transition-colors hover:border-foreground'
    >
      {children}
    </a>
  );
}

export default function AboutPage() {
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
            About
          </span>
          <h1 className='mt-4 font-serif text-5xl leading-[1.05] tracking-tight'>
            Built by Matthew Rhoads
          </h1>

          <div className='mt-8 max-w-prose space-y-5 leading-relaxed text-muted'>
            <p>
              I&apos;m <strong className='text-foreground'>Matthew Rhoads</strong>,
              a Sanity specialist and the developer behind RenderOnce. I help
              teams turn what they publish into video, audio, and email —
              automatically, no manual busywork. RenderOnce is one of those
              systems, built in the open: production code you can read, fork, and
              ship.
            </p>
            <p>
              RenderOnce is open-source, released in partnership with{' '}
              <A href={FORTIVEX_URL}>Fortivex</A>.
            </p>
            <p>
              When I&apos;m not building open tooling like this, I run{' '}
              <A href={SANITY_MIGRATIONS_URL}>Sanity Migrations</A> — specialist
              consulting for content, schema, and platform migrations — under my
              studio, <A href={ZEPHYR_PIXELS_URL}>Zephyr Pixels</A>.
            </p>
          </div>

          <div className='mt-10 flex flex-wrap items-center gap-4'>
            <a
              href={GITHUB_REPO_URL}
              target='_blank'
              rel='noreferrer'
              className='group inline-flex items-center gap-2 rounded-full border border-foreground/30 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-foreground'
            >
              <span>View the source on GitHub</span>
              <span className='transition-transform group-hover:translate-x-1'>
                →
              </span>
            </a>
            <a
              href={FORTIVEX_INTAKE_URL}
              target='_blank'
              rel='noreferrer'
              className='group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90'
            >
              <span>Work with me</span>
              <span className='transition-transform group-hover:translate-x-1'>
                →
              </span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
