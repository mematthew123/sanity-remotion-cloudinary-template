'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className='mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center'>
      <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>Error</span>
      <h1 className='mt-4 font-serif text-4xl tracking-tight sm:text-5xl'>Something went wrong.</h1>
      <p className='mt-5 font-serif text-xl/relaxed text-muted italic'>
        The page couldn’t load. Try again in a moment.
      </p>
      <button
        type='button'
        onClick={reset}
        className='mt-10 rounded-lg bg-foreground px-5 py-2.5 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent'
      >
        Try again
      </button>
    </div>
  );
}
