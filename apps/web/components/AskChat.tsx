'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState } from 'react';

const SUGGESTIONS = [
  'What topics do the articles cover?',
  'Which articles have videos?',
  'How does the render-once pipeline work?',
];

const TOOL_LABELS: Record<string, string> = {
  knowledge_base_search: 'Searched the knowledge base',
  knowledge_base_read: 'Read knowledge base entries',
  groq_query: 'Queried the catalog',
  schema_explorer: 'Checked the content model',
  array_field_reader: 'Read an article',
};

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((chunk, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={chunk}
            className='break-all text-accent underline underline-offset-2 hover:text-foreground'
          >
            {chunk}
          </a>
        ) : (
          chunk
        ),
      )}
    </>
  );
}

function MessageBody({ message }: { message: UIMessage }) {
  const toolNames = [
    ...new Set(
      message.parts.flatMap((part) => (part.type === 'dynamic-tool' ? [part.toolName] : [])),
    ),
  ];
  const lastToolIndex = message.parts.findLastIndex((part) => part.type === 'dynamic-tool');

  return (
    <div className='space-y-3'>
      {toolNames.length > 0 && (
        <ul className='flex flex-wrap gap-2'>
          {toolNames.map((name) => (
            <li
              key={name}
              className='rounded-full border border-foreground/10 px-3 py-1 font-mono text-[0.65rem] tracking-wide text-muted uppercase'
            >
              {TOOL_LABELS[name] ?? name}
            </li>
          ))}
        </ul>
      )}
      {message.parts.map((part, i) =>
        part.type === 'text' && i > lastToolIndex ? (
          <p key={i} className='whitespace-pre-wrap'>
            <Linkified text={part.text} />
          </p>
        ) : null,
      )}
    </div>
  );
}

export default function AskChat() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ask' }),
  });
  const [input, setInput] = useState('');
  const busy = status === 'submitted' || status === 'streaming';

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    sendMessage({ text: question });
    setInput('');
  }

  return (
    <div className='space-y-8'>
      {messages.length === 0 ? (
        <ul className='flex flex-wrap gap-3'>
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type='button'
                onClick={() => ask(s)}
                className='rounded-lg border border-foreground/15 px-4 py-2 text-left text-sm transition-colors hover:border-accent hover:text-accent'
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ol className='space-y-8' aria-live='polite'>
          {messages.map((m) => (
            <li key={m.id}>
              <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
                {m.role === 'user' ? 'You' : 'Answer'}
              </span>
              <div
                className={`mt-2 text-lg/relaxed ${m.role === 'user' ? 'font-serif italic' : ''}`}
              >
                <MessageBody message={m} />
              </div>
            </li>
          ))}
          {status === 'submitted' && (
            <li className='font-mono text-xs tracking-wide text-muted uppercase'>Looking it up…</li>
          )}
        </ol>
      )}

      {error && (
        <p role='alert' className='text-sm text-red-600'>
          {error.message || 'Something went wrong. Please try again.'}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className='flex flex-col gap-3 sm:flex-row'
      >
        <label htmlFor='ask-input' className='sr-only'>
          Your question
        </label>
        <input
          id='ask-input'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask about the articles or their videos'
          maxLength={1500}
          disabled={busy}
          className='min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm transition-colors focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
        />
        <button
          type='submit'
          disabled={busy || !input.trim()}
          className='shrink-0 rounded-lg bg-foreground px-5 py-2.5 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent disabled:opacity-60'
        >
          {busy ? 'Answering…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
