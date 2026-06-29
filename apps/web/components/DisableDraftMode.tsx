'use client';

import { useEffect, useState } from 'react';

// Draft-mode exit banner; hidden inside the Presentation iframe (i.e. when framed).
export default function DisableDraftMode() {
  const [topLevel, setTopLevel] = useState(false);

  useEffect(() => {
    setTopLevel(window === window.parent && !window.opener);
  }, []);

  if (!topLevel) return null;

  return (
    <a
      href='/api/draft-mode/disable'
      className='fixed bottom-4 left-4 z-50 rounded-full bg-foreground px-4 py-2 font-mono text-xs tracking-[0.15em] text-background uppercase shadow-lg transition-opacity hover:opacity-90'
    >
      Draft mode — disable
    </a>
  );
}
