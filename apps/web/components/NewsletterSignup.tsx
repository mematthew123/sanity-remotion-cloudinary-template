'use client';

import {useState} from 'react';

// Public newsletter signup. Posts to /api/newsletter/subscribe, which emails a
// double-opt-in confirm link — so success here means "check your inbox", not
// "subscribed". Includes a hidden honeypot field (`company`) to deter bots.
type State = 'idle' | 'submitting' | 'success' | 'error';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot — real users never fill this
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, company}),
      });
      const data = (await res.json().catch(() => ({}))) as {ok?: boolean; error?: string};
      if (res.ok && data.ok) {
        setState('success');
      } else {
        setState('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  if (state === 'success') {
    return (
      <p className='font-serif text-lg/relaxed text-foreground italic'>
        Check your inbox — we sent a link to confirm your subscription.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className='mx-auto flex max-w-md flex-col gap-3 sm:flex-row'>
      <label htmlFor='newsletter-email' className='sr-only'>
        Email address
      </label>
      <input
        id='newsletter-email'
        type='email'
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder='you@example.com'
        autoComplete='email'
        disabled={state === 'submitting'}
        className='min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm transition-colors focus:border-accent focus:outline-none'
      />
      {/* Honeypot: off-screen, not tabbable, hidden from assistive tech. */}
      <input
        type='text'
        name='company'
        tabIndex={-1}
        autoComplete='off'
        aria-hidden='true'
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className='pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0'
      />
      <button
        type='submit'
        disabled={state === 'submitting'}
        className='shrink-0 rounded-lg bg-foreground px-5 py-2.5 font-mono text-xs tracking-wide text-background uppercase transition-colors hover:bg-accent disabled:opacity-60'
      >
        {state === 'submitting' ? 'Sending…' : 'Subscribe'}
      </button>
      {state === 'error' && (
        <p className='basis-full text-sm text-red-600 sm:text-left'>{message}</p>
      )}
    </form>
  );
}
