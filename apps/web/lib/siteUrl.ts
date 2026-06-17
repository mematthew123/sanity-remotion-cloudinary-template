// Canonical public origin for absolute URLs (OG tags, sitemap, RSS feed).
// Mirrors the fallback used by the newsletter routes. Set NEXT_PUBLIC_SITE_URL
// in production so shared links, feeds, and structured data resolve correctly.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

/** Join a path onto SITE_URL, ensuring exactly one slash. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
