import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { after } from 'next/server';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type LimiterOptions = { prefix: string; limit: number; windowSeconds: number };
export type RateLimitResult = { limited: boolean; refund: () => Promise<void> };
export type RateLimiter = (key: string) => Promise<RateLimitResult>;

const noRefund = async () => {};

export function createLimiter({ prefix, limit, windowSeconds }: LimiterOptions): RateLimiter {
  if (redis) {
    const window = `${windowSeconds} s` as const;
    const ratelimit = new Ratelimit({
      redis,
      prefix: `ratelimit:${prefix}`,
      limiter:
        limit === 1
          ? Ratelimit.tokenBucket(1, window, 1)
          : Ratelimit.slidingWindow(limit, window),
      timeout: 1000,
    });
    return async (key) => {
      try {
        const { success, pending } = await ratelimit.limit(key);
        after(() => pending);
        if (!success) return { limited: true, refund: noRefund };
        return {
          limited: false,
          refund: async () => {
            try {
              await ratelimit.limit(key, { rate: -1 });
            } catch (err) {
              console.warn(`[rateLimit:${prefix}] Redis unavailable, could not refund:`, err);
            }
          },
        };
      } catch (err) {
        console.warn(`[rateLimit:${prefix}] Redis unavailable, allowing request:`, err);
        return { limited: false, refund: noRefund };
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
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { limited: true, refund: noRefund };
    }
    recent.push(now);
    hits.set(key, recent);
    return {
      limited: false,
      refund: async () => {
        const times = hits.get(key);
        const i = times?.lastIndexOf(now) ?? -1;
        if (!times || i < 0) return;
        times.splice(i, 1);
        if (times.length === 0) hits.delete(key);
      },
    };
  };
}
