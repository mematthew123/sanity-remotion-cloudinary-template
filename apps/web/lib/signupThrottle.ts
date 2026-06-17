// Best-effort per-address throttle for the public signup route, to blunt
// confirm-email spam. In-memory, so it resets on cold start and isn't shared
// across serverless instances — for real production back this with a durable
// store (Vercel KV / Upstash). Double opt-in is the primary protection; this
// just limits repeat confirm sends to the same address.
//
// Lives in a .ts module (not the .tsx route) so the Date.now() read doesn't trip
// the react-hooks/purity lint rule, which treats functions in .tsx as components.
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

export function isThrottled(email: string): boolean {
  const prev = lastSent.get(email);
  return prev !== undefined && Date.now() - prev < THROTTLE_MS;
}

export function markSent(email: string): void {
  lastSent.set(email, Date.now());
}
