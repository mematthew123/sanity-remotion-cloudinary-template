import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { after } from 'next/server';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type LimiterOptions = { prefix: string; limit: number; windowSeconds: number };
export type IsRateLimited = (key: string) => Promise<boolean>;

export function createLimiter({ prefix, limit, windowSeconds }: LimiterOptions): IsRateLimited {
  if (redis) {
    const ratelimit = new Ratelimit({
      redis,
      prefix: `ratelimit:${prefix}`,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      timeout: 1000,
    });
    return async (key) => {
      try {
        const { success, pending } = await ratelimit.limit(key);
        after(() => pending);
        return !success;
      } catch (err) {
        console.warn(`[rateLimit:${prefix}] Redis unavailable, allowing request:`, err);
        return false;
      }
    };
  }

  const windowMs = windowSeconds * 1000;
  const hits = new Map<string, number[]>();
  let lastSweep = 0;
  return async (key) => {
    const now = Date.now();
    if (now - lastSweep >= windowMs) {
      lastSweep = now;
      for (const [k, times] of hits) {
        if (now - times[times.length - 1] >= windowMs) hits.delete(k);
      }
    }
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const limited = recent.length >= limit;
    if (!limited) recent.push(now);
    hits.set(key, recent);
    return limited;
  };
}
