import { notFound } from 'next/navigation';
import AskChat from '@/components/AskChat';
import { isAskEnabled } from '@/lib/askConfig';

export const metadata = {
  title: 'Ask',
  description:
    'Ask questions about the articles and their videos, answered from a Sanity Context Knowledge Base.',
};

export default function AskPage() {
  if (!isAskEnabled()) notFound();

  return (
    <div className='mx-auto max-w-3xl px-6 py-20'>
      <header className='mb-14 border-b border-foreground/10 pb-10'>
        <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
          Sanity Context · Knowledge Base
        </span>
        <h1 className='mt-4 font-serif text-5xl tracking-tight'>Ask the site</h1>
        <p className='mt-4 max-w-xl font-serif text-xl/relaxed text-muted italic'>
          Answers come from a Knowledge Base built from these articles, plus the live catalog
          of rendered videos. If something isn&apos;t covered, it says so.
        </p>
      </header>
      <AskChat />
    </div>
  );
}
