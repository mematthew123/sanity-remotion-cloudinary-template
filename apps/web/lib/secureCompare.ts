import {timingSafeEqual} from 'node:crypto'

/**
 * Constant-time string comparison for bearer secrets — avoids leaking how much
 * of a secret matched via response timing. Returns false on a length mismatch
 * (the lengths themselves are not secret).
 */
export function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}
