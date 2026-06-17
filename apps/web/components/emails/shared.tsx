import {Img, Link, Text} from '@react-email/components';
import type {ReactNode} from 'react';

// Shared building blocks for every transactional email (newsletter, welcome,
// confirmation). Factored out so the templates stay DRY — one set of inline
// styles, one Portable-Text walker, one GIF-hero block. Add a new email by
// composing these, not by copying them.

export const emailStyles = {
  body: {backgroundColor: '#f6f6f6', margin: 0, padding: '24px 0', fontFamily: 'system-ui, sans-serif'},
  container: {backgroundColor: '#ffffff', maxWidth: '600px', margin: '0 auto', padding: '32px'},
  preheader: {color: '#666666', fontSize: '14px', lineHeight: '20px', margin: '0 0 16px 0'},
  hero: {
    // position:relative is the anchor for the play-button overlay below.
    // lineHeight:0 prevents the descender gap email clients add under <img>.
    position: 'relative' as const,
    lineHeight: 0,
    margin: '0 0 24px 0',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'block',
  },
  heroImg: {width: '100%', height: 'auto', display: 'block', border: 0},
  // Absolute centering via top/right/bottom/left:0 + margin:auto + fixed
  // dimensions. Survives Outlook better than `translate(-50%,-50%)`. In the
  // few clients that drop absolute positioning entirely, the button just
  // appears stacked below the image — still readable, no broken layout.
  playButton: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    margin: 'auto',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.72)',
    color: '#ffffff',
    fontSize: '28px',
    lineHeight: '72px',
    textAlign: 'center' as const,
    textDecoration: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  // Optical centering for the play triangle — visually balances the negative
  // space inside ▶ which sits visually left of geometric center.
  playGlyph: {paddingLeft: '6px', display: 'inline-block'},
  heading: {fontSize: '28px', lineHeight: '1.2', fontWeight: 700, color: '#111111', margin: '0 0 16px 0'},
  excerpt: {fontSize: '16px', lineHeight: '24px', color: '#333333', margin: '0 0 24px 0'},
  intro: {fontSize: '16px', lineHeight: '24px', color: '#333333', margin: '0 0 24px 0'},
  button: {
    backgroundColor: '#111111',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '6px',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
  },
  hr: {border: 'none', borderTop: '1px solid #eaeaea', margin: '32px 0'},
  footer: {color: '#999999', fontSize: '12px', lineHeight: '18px', textAlign: 'center' as const, margin: 0},
  footerLink: {color: '#999999', textDecoration: 'underline'},
};

// Inline Portable Text walker. We don't import @portabletext/react here because
// the post page depends on it not being externalized, while @react-email/* must
// be externalized — mixing the two in this file crashes the email render with a
// null-dispatcher (two React instances). See next.config.ts.
type PtSpan = {_type: 'span'; _key?: string; text: string; marks?: string[]};
type PtMarkDef = {_key: string; _type: string; href?: string};
type PtBlock = {
  _type: 'block';
  _key?: string;
  style?: string;
  children?: PtSpan[];
  markDefs?: PtMarkDef[];
};

function renderSpan(span: PtSpan, markDefs: PtMarkDef[], key: string): ReactNode {
  let node: ReactNode = span.text;
  for (const mark of span.marks ?? []) {
    if (mark === 'em') {
      node = <em key={`em-${key}`}>{node}</em>;
      continue;
    }
    if (mark === 'strong') {
      node = <strong key={`strong-${key}`}>{node}</strong>;
      continue;
    }
    const def = markDefs.find((d) => d._key === mark);
    if (def?._type === 'link') {
      node = (
        <Link
          key={`link-${key}`}
          href={def.href ?? '#'}
          style={{color: '#111111', textDecoration: 'underline'}}
        >
          {node}
        </Link>
      );
    }
  }
  return <span key={key}>{node}</span>;
}

export function renderIntro(blocks: unknown[]): ReactNode {
  return blocks.map((raw, blockIdx) => {
    const block = raw as PtBlock;
    if (block?._type !== 'block') return null;
    if ((block.style ?? 'normal') !== 'normal') return null;
    const key = block._key ?? `b-${blockIdx}`;
    const markDefs = block.markDefs ?? [];
    return (
      <Text key={key} style={emailStyles.intro}>
        {(block.children ?? []).map((span, spanIdx) =>
          renderSpan(span, markDefs, span._key ?? `${key}-${spanIdx}`),
        )}
      </Text>
    );
  });
}

// GIF-hero block factored out so the wrapper differs by whether we have a click
// target: a real <a> when ctaHref exists (whole hero clicks to the post), a
// plain <div> otherwise. The play button is always present; it's the strong
// visual cue that the GIF represents a video.
export function Hero({
  heroUrl,
  heroAlt,
  ctaHref,
}: {
  heroUrl: string;
  heroAlt: string;
  ctaHref: string | null;
}) {
  const img = (
    <Img src={heroUrl} alt={heroAlt} width={540} style={emailStyles.heroImg} />
  );
  const overlay = (
    <span style={emailStyles.playButton} aria-hidden="true">
      <span style={emailStyles.playGlyph}>▶</span>
    </span>
  );
  if (ctaHref) {
    return (
      <Link href={ctaHref} style={emailStyles.hero}>
        {img}
        {overlay}
      </Link>
    );
  }
  return (
    <div style={emailStyles.hero}>
      {img}
      {overlay}
    </div>
  );
}
