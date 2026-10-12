import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className='mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center'>
      <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>404</span>
      <h1 className='mt-4 font-serif text-4xl tracking-tight sm:text-5xl'>Nothing here.</h1>
      <p className='mt-5 font-serif text-xl/relaxed text-muted italic'>
        That page doesn’t exist, or it was moved.
      </p>
      <Link
        href='/'
        className='mt-10 rounded-lg bg-foreground px-5 py-2.5 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent'
      >
        Back home
      </Link>
    </div>
  );
}
