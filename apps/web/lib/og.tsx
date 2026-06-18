import { SITE_URL } from '@/lib/siteUrl';

/**
 * Shared building blocks for on-brand share images rendered with `next/og`
 * (Satori). Centralized here so every `opengraph-image` / `twitter-image`
 * route renders the same 1200×630 card and the palette stays in sync with
 * globals.css / COLORS in @template/video-core.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

// Mirrors globals.css + COLORS. Swap these five to rebrand the card with the
// rest of the template.
const BRAND = {
  background: '#F5F4F0',
  foreground: '#141414',
  accent: '#3B5BDB',
  highlight: '#FFD43B',
  muted: '#6B7280',
} as const;

/**
 * Fetch the brand fonts as TTF buffers for Satori. Google's css2 endpoint
 * returns a single truetype `src` when a `text` subset is supplied (and no
 * woff2-capable User-Agent is sent), which is exactly the format ImageResponse
 * needs. Subsetting to the glyphs actually used keeps the payload tiny.
 */
async function loadGoogleFont(family: string, text: string, italic = false) {
  const axis = italic ? ':ital@1' : '';
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(
    / /g,
    '+',
  )}${axis}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
  )?.[1];
  if (!src) throw new Error(`Could not resolve a TTF for ${family}`);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to download ${family} (${res.status})`);
  return res.arrayBuffer();
}

export type ShareFont = {
  name: string;
  data: ArrayBuffer;
  style?: 'normal' | 'italic';
  weight?: 400 | 500 | 600 | 700 | 800;
};

/**
 * Load the two typefaces the card uses, subset to `text`. Returns the array
 * `ImageResponse` expects under its `fonts` option.
 */
export async function loadBrandFonts(text: string): Promise<ShareFont[]> {
  const [serif, mono] = await Promise.all([
    loadGoogleFont('Instrument Serif', text, true),
    loadGoogleFont('JetBrains Mono', text),
  ]);
  return [
    { name: 'Instrument Serif', data: serif, style: 'italic', weight: 400 },
    { name: 'JetBrains Mono', data: mono, style: 'normal', weight: 700 },
  ];
}

/**
 * The on-brand share card. `kicker` is the small mono eyebrow, `title` the
 * large serif headline. Used by the site-wide default OG image and reusable
 * for per-page cards (posts, etc.).
 */
export function ShareCard({
  kicker,
  title,
  brand = 'Template',
}: {
  kicker: string;
  title: string;
  brand?: string;
}) {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '76px 80px',
        backgroundColor: BRAND.background,
        color: BRAND.foreground,
        position: 'relative',
        fontFamily: 'JetBrains Mono',
      }}
    >
      {/* Soft highlight bloom in the top-right for brand texture. */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -160,
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: BRAND.highlight,
          opacity: 0.22,
        }}
      />

      {/* Brand lockup — accent dot + name, mirrors the video BrandLockup. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: BRAND.accent,
          }}
        />
        <div
          style={{
            fontFamily: 'Instrument Serif',
            fontStyle: 'italic',
            fontSize: 40,
            letterSpacing: '-0.01em',
          }}
        >
          {brand}
        </div>
      </div>

      {/* Headline block. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            fontFamily: 'JetBrains Mono',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: BRAND.accent,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: 'Instrument Serif',
            fontStyle: 'italic',
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: 940,
          }}
        >
          {title}
        </div>
      </div>

      {/* Footer row: domain + thin accent rule. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: BRAND.muted,
          }}
        >
          {host}
        </div>
        <div
          style={{ display: 'flex', height: 8, width: 220, borderRadius: 4 }}
        >
          <div style={{ flex: 1, background: BRAND.accent, borderRadius: 4 }} />
        </div>
      </div>

      {/* Full-bleed accent bar pinned to the very bottom edge. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 14,
          background: BRAND.accent,
        }}
      />
    </div>
  );
}
