'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useEffect, useRef, useState } from 'react';
import {
  answerTextOf,
  classifyLink,
  errorMessageOf,
  exchangesOf,
  parseAnswer,
  stepsOf,
  URL_RE,
  type PostRef,
} from '@/lib/askAnswer';

const SUGGESTION_GROUPS = [
  {
    label: 'The pipeline',
    items: ['How does the render-once pipeline work?', 'How are the formats derived?'],
  },
  {
    label: 'Setup',
    items: ['How do I run the template locally without Vercel?', 'What does it cost to run?'],
  },
  {
    label: 'The renders',
    items: ['Which posts have rendered videos?', 'What formats did the latest render come in?'],
  },
];

const FOLLOW_UPS: { match: RegExp; items: string[] }[] = [
  {
    match: /video|format/i,
    items: ['How are the formats derived?', 'Can I add my own format?', 'Which post was rendered last?'],
  },
  {
    match: /local|vercel|setup|install|deploy/i,
    items: ['What does it cost to run?', 'What needs Vercel?', 'How do I deploy the Studio?'],
  },
  {
    match: /pipeline|render|how/i,
    items: ['Why render only once?', 'Where does the video show up?', 'How long does a render take?'],
  },
];

const DEFAULT_FOLLOW_UPS = [
  'Which posts have rendered videos?',
  'How do I run the template locally?',
  'What does it cost to run?',
];

function followUpsFor(question: string): string[] {
  return FOLLOW_UPS.find((f) => f.match.test(question))?.items ?? DEFAULT_FOLLOW_UPS;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className='inline-block size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent'
    />
  );
}

function Linkified({ text, posts }: { text: string; posts: PostRef[] }) {
  return (
    <>
      {text.split(URL_RE).map((chunk, i) => {
        if (i % 2 === 0) return chunk;
        const link = classifyLink(chunk, posts);
        const className =
          'text-accent underline decoration-accent/30 underline-offset-3 transition-colors hover:decoration-accent';
        if (link.kind === 'post')
          return (
            <Link key={i} href={link.href} className={className}>
              {link.post.title}
            </Link>
          );
        return (
          <a key={i} href={chunk} className={`${className} wrap-anywhere`}>
            {link.label}
          </a>
        );
      })}
    </>
  );
}

const AnswerBody = memo(function AnswerBody({ text, posts }: { text: string; posts: PostRef[] }) {
  return (
    <div className='space-y-4'>
      {parseAnswer(text, posts).map((block, i) => {
        if (block.type === 'p')
          return (
            <p key={i}>
              <Linkified text={block.text} posts={posts} />
            </p>
          );
        if (block.type === 'list')
          return (
            <ul key={i} className='space-y-2'>
              {block.items.map((item, j) => (
                <li key={j} className='grid grid-cols-[1.25rem_1fr]'>
                  <span className='text-accent'>–</span>
                  <span>
                    <Linkified text={item} posts={posts} />
                  </span>
                </li>
              ))}
            </ul>
          );
        const { link, caption } = block;
        if (link.kind === 'post')
          return (
            <Link
              key={i}
              href={link.href}
              className='group grid grid-cols-[88px_1fr] items-center gap-5'
            >
              <span className='relative aspect-4/3 overflow-hidden rounded-md bg-muted/10'>
                {link.post.imageUrl && (
                  <Image
                    src={link.post.imageUrl}
                    alt=''
                    fill
                    sizes='88px'
                    unoptimized={link.post.imageUrl.startsWith('https://cdn.sanity.io/')}
                    className='object-cover transition-transform duration-500 group-hover:scale-[1.03]'
                  />
                )}
              </span>
              <span>
                <span className='block font-serif text-xl/tight tracking-tight transition-colors group-hover:text-accent'>
                  {link.post.title}
                </span>
                {caption && <span className='mt-1 block text-base/snug text-muted'>{caption}</span>}
                <span className='mt-1.5 inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-wide text-foreground/60 uppercase transition-colors group-hover:text-foreground'>
                  Read article
                  <span className='transition-transform group-hover:translate-x-1'>→</span>
                </span>
              </span>
            </Link>
          );
        return (
          <a
            key={i}
            href={link.url}
            target='_blank'
            rel='noreferrer'
            className='flex w-fit max-w-full items-center gap-2 font-mono text-xs tracking-wide text-muted uppercase transition-colors hover:text-accent'
          >
            <span className='min-w-0 wrap-anywhere'>
              {link.kind === 'doc' ? `From the docs: ${link.label}` : link.label}
            </span>
            <span aria-hidden>↗</span>
          </a>
        );
      })}
    </div>
  );
});

export default function AskChat({
  posts,
  maxQuestionChars,
}: {
  posts: PostRef[];
  maxQuestionChars: number;
}) {
  const [stoppedIds, setStoppedIds] = useState<string[]>([]);
  const { messages, sendMessage, setMessages, regenerate, stop, status, error, clearError } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/ask' }),
      onFinish: ({ messages, isAbort }) => {
        const question = messages.findLast((m) => m.role === 'user');
        if (isAbort && question) setStoppedIds((ids) => [...ids, question.id]);
      },
    });
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastExchangeRef = useRef<HTMLLIElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const exchanges = exchangesOf(messages);

  useEffect(() => {
    lastExchangeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [exchanges.length]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    sendMessage({ text: question });
    setInput('');
  }

  function retry() {
    const last = exchanges.at(-1);
    if (last) setStoppedIds((ids) => ids.filter((id) => id !== last.id));
    regenerate();
  }

  function reset() {
    stop();
    setMessages([]);
    setStoppedIds([]);
    clearError();
    inputRef.current?.focus();
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    });
  }

  return (
    <div className='mx-auto max-w-3xl px-6 pt-20'>
      <header className='mb-14 flex items-end justify-between gap-6 border-b border-foreground/10 pb-10'>
        <div>
          <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
            Sanity Context · Knowledge Base
          </span>
          <h1 className='mt-4 font-serif text-5xl tracking-tight'>Ask the template</h1>
          <p className='mt-4 max-w-xl font-serif text-xl/relaxed text-muted italic'>
            Answers come from the template&apos;s docs and the live catalog of rendered videos. If
            something isn&apos;t covered, it says so.
          </p>
        </div>
        {exchanges.length > 0 && (
          <button
            type='button'
            onClick={reset}
            className='shrink-0 font-mono text-xs tracking-[0.15em] text-muted uppercase transition-colors hover:text-foreground'
          >
            New conversation
          </button>
        )}
      </header>

      {exchanges.length === 0 ? (
        <div className='space-y-12 pb-16'>
          {SUGGESTION_GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className='mb-2 font-mono text-xs tracking-[0.2em] text-muted uppercase'>
                {group.label}
              </h2>
              <ul>
                {group.items.map((s) => (
                  <li key={s} className='border-b border-foreground/10'>
                    <button
                      type='button'
                      onClick={() => ask(s)}
                      className='group flex w-full items-center justify-between gap-6 py-4 text-left font-serif text-2xl/tight tracking-tight transition-colors hover:text-accent'
                    >
                      {s}
                      <span className='font-sans text-base text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent'>
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ol className='space-y-16 pb-16' aria-live='polite'>
          {exchanges.map((exchange, i) => {
            const isLast = i === exchanges.length - 1;
            const steps = exchange.answer ? stepsOf(exchange.answer, isLast && busy) : [];
            const finished = !isLast || status === 'ready';
            const stopped = stoppedIds.includes(exchange.id);
            const text = exchange.answer ? answerTextOf(exchange.answer, finished) : '';
            return (
              <li
                key={exchange.id}
                ref={isLast ? lastExchangeRef : undefined}
                className='scroll-mt-8'
              >
                <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
                  Q · {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className='mt-3 font-serif text-3xl/tight tracking-tight text-balance'>
                  {exchange.question}
                </h2>

                {(steps.length > 0 || (isLast && busy)) && (
                  <div className='mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.65rem] tracking-wide text-muted uppercase'>
                    {steps.map((step) => (
                      <span key={step.id} className='inline-flex items-center gap-1.5'>
                        {step.state === 'done' && <span className='text-accent'>✓</span>}
                        {step.state === 'failed' && <span className='text-red-700'>×</span>}
                        {step.state === 'active' && <Spinner />}
                        {step.state === 'stopped' && <span aria-hidden>■</span>}
                        {step.label}
                        {step.state === 'stopped' && ' · stopped'}
                      </span>
                    ))}
                    {isLast && busy && steps.length === 0 && (
                      <span className='inline-flex items-center gap-1.5'>
                        <Spinner /> Looking it up
                      </span>
                    )}
                  </div>
                )}

                {text && (
                  <div className='mt-6 border-l-2 border-accent/30 pl-6 text-lg/relaxed'>
                    <AnswerBody text={text} posts={posts} />
                  </div>
                )}

                {!isLast && !exchange.answer && !stopped && (
                  <p className='mt-6 border-l-2 border-accent/30 pl-6 text-lg/relaxed text-muted'>
                    No answer came back for this one.
                  </p>
                )}

                {finished && stopped && (
                  <p className='mt-6 border-l-2 border-accent/30 pl-6 text-lg/relaxed text-muted'>
                    {text ? 'Stopped before the answer finished.' : 'Stopped.'}
                  </p>
                )}

                {finished && !stopped && exchange.answer && !text && !(isLast && error) && (
                  <p className='mt-6 border-l-2 border-accent/30 pl-6 text-lg/relaxed text-muted'>
                    Couldn&apos;t finish an answer for that one. Try asking it more narrowly.
                  </p>
                )}

                {finished && (text || (stopped && isLast)) && (
                  <div className='mt-6 flex gap-5 pl-6 font-mono text-[0.65rem] tracking-wide text-muted uppercase'>
                    {text && (
                      <button
                        type='button'
                        onClick={() => copy(exchange.id, text)}
                        className='transition-colors hover:text-foreground'
                      >
                        {copiedId === exchange.id ? 'Copied' : 'Copy answer'}
                      </button>
                    )}
                    {isLast && (
                      <button
                        type='button'
                        onClick={retry}
                        className='transition-colors hover:text-foreground'
                      >
                        Ask again
                      </button>
                    )}
                  </div>
                )}

                {isLast && error && (
                  <div
                    role='alert'
                    className='mt-6 flex items-center justify-between gap-4 rounded-lg border border-red-600/20 bg-red-600/5 px-4 py-3 text-sm text-red-700'
                  >
                    {errorMessageOf(error)}
                    <button
                      type='button'
                      onClick={retry}
                      className='shrink-0 font-mono text-xs tracking-wide uppercase underline underline-offset-2'
                    >
                      Try again
                    </button>
                  </div>
                )}

                {isLast && finished && text && !stopped && !error && (
                  <div className='mt-10'>
                    <span className='font-mono text-xs tracking-[0.2em] text-muted uppercase'>
                      Keep going
                    </span>
                    <ul className='mt-3 flex flex-wrap gap-2'>
                      {followUpsFor(exchange.question).map((s) => (
                        <li key={s}>
                          <button
                            type='button'
                            onClick={() => ask(s)}
                            className='rounded-full border border-foreground/15 px-4 py-1.5 font-serif text-base italic transition-colors hover:border-accent hover:text-accent'
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className='sticky bottom-0 -mx-6 mb-16 border-t border-foreground/10 bg-background/90 px-6 pt-4 pb-5 backdrop-blur'
      >
        <label htmlFor='ask-input' className='sr-only'>
          Your question
        </label>
        <div className='flex items-end gap-3 rounded-xl border border-foreground/15 bg-white/60 p-2 transition-colors focus-within:border-accent'>
          <textarea
            id='ask-input'
            ref={inputRef}
            value={input}
            rows={1}
            maxLength={maxQuestionChars}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={
              exchanges.length ? 'Ask a follow-up…' : 'Ask about the template or its renders…'
            }
            className='max-h-48 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted'
          />
          {busy ? (
            <button
              type='button'
              onClick={stop}
              className='shrink-0 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs tracking-wide uppercase transition-colors hover:border-foreground'
            >
              ■ Stop
            </button>
          ) : (
            <button
              type='submit'
              disabled={!input.trim()}
              className='shrink-0 rounded-lg bg-foreground px-4 py-2 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent disabled:opacity-40'
            >
              Ask ↵
            </button>
          )}
        </div>
        <div className='mt-2 flex justify-between px-1 font-mono text-[0.6rem] tracking-wide text-muted uppercase'>
          <span>Enter to send · Shift + Enter for a new line</span>
          {maxQuestionChars - input.length < 200 && (
            <span>{maxQuestionChars - input.length} left</span>
          )}
        </div>
      </form>
    </div>
  );
}
