import Link from 'next/link';
import type {Metadata} from 'next';

// Landing page the confirm route redirects to. Reads ?status to show the right
// copy for each double-opt-in outcome. Static, no data fetch.
export const metadata: Metadata = {
  title: 'Subscription',
  robots: {index: false},
};

type Status = 'ok' | 'already' | 'invalid' | 'error';

const COPY: Record<Status, {eyebrow: string; title: string; body: string}> = {
  ok: {
    eyebrow: 'Subscribed',
    title: "You're in.",
    body: 'Your subscription is confirmed — your first video is on its way to your inbox.',
  },
  already: {
    eyebrow: 'Already subscribed',
    title: 'You were already on the list.',
    body: 'Nothing more to do — you’ll keep receiving new videos as they’re published.',
  },
  invalid: {
    eyebrow: 'Link expired',
    title: 'That link didn’t work.',
    body: 'The confirmation link is invalid or has expired. Head back and subscribe again to get a fresh one.',
  },
  error: {
    eyebrow: 'Something went wrong',
    title: 'We couldn’t confirm that.',
    body: 'Something went wrong on our end. Please try subscribing again in a little while.',
  },
};

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{status?: string}>;
}) {
  const {status} = await searchParams;
  const key: Status = (['ok', 'already', 'invalid', 'error'] as const).includes(
    status as Status,
  )
    ? (status as Status)
    : 'error';
  const copy = COPY[key];

  return (
    <div className='mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center'>
      <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
        {copy.eyebrow}
      </span>
      <h1 className='mt-4 font-serif text-4xl tracking-tight sm:text-5xl'>{copy.title}</h1>
      <p className='mt-5 font-serif text-xl/relaxed text-muted italic'>{copy.body}</p>
      <Link
        href='/'
        className='mt-10 rounded-lg bg-foreground px-5 py-2.5 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent'
      >
        Back home
      </Link>
    </div>
  );
}
