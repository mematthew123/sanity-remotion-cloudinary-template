import {createHmac, timingSafeEqual} from 'node:crypto';

// Stateless double-opt-in tokens. A signup encodes `{email, exp}`, HMAC-signs it
// (no database of pending signups), and emails the token inside the confirm
// link. The confirm route verifies the signature + expiry — so a forged or
// expired link can't subscribe anyone.

/**
 * The signing key: NEWSLETTER_TOKEN_SECRET. Falls back to NEWSLETTER_SEND_SECRET
 * for existing deployments, but that value is also a bearer that can trigger
 * audience sends — set a separate token secret so public signup doesn't depend
 * on it.
 */
export const SUBSCRIBE_TOKEN_SECRET =
  process.env.NEWSLETTER_TOKEN_SECRET || process.env.NEWSLETTER_SEND_SECRET;

const TTL_MS = 1000 * 60 * 60 * 24; // 24h window to click confirm

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSubscribeToken(email: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({email, exp: Date.now() + TTL_MS}),
    'utf8',
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the email if the token is well-formed, correctly signed, and unexpired — else null. */
export function verifySubscribeToken(token: string, secret: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const {email, exp} = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as {email?: string; exp?: number};
    if (!email || !exp || Date.now() > exp) return null;
    return email;
  } catch {
    return null;
  }
}
