import { notFound } from 'next/navigation';
import AskChat from '@/components/AskChat';
import { isAskEnabled, MAX_QUESTION_CHARS } from '@/lib/askConfig';

export const metadata = {
  title: 'Ask',
  description:
    'Ask about the articles, their videos, or the template behind the site, answered from a Sanity Context Knowledge Base.',
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
          Answers come from a Knowledge Base built from these articles and the template&apos;s
          docs, plus the live catalog of rendered videos. If something isn&apos;t covered, it
          says so.
        </p>
      </header>
      <AskChat maxQuestionChars={MAX_QUESTION_CHARS} />
    </div>
  );
}
