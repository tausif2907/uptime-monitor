import { Redis } from "ioredis";

/**
 * Fixed-window rate limiting in Redis (works across every server instance).
 *
 * Fails OPEN: if Redis is unreachable we log and allow the request, because locking every
 * user out of sign-in during a Redis blip is worse than briefly losing brute-force protection.
 */
export interface Limit {
  key: string;
  limit: number;
  windowSec: number;
}

const TIMEOUT_MS = 1500;
const globalForRl = globalThis as unknown as { rateLimitRedis?: Redis };

function redis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  globalForRl.rateLimitRedis ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  return globalForRl.rateLimitRedis;
}

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("rate limiter timeout")), TIMEOUT_MS)),
  ]);
}

const k = (key: string) => `rl:${key}`;

/** Count this attempt; returns blocked=true if any limit is now exceeded. */
export async function consume(limits: Limit[]): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const client = redis();
  if (!client) return { blocked: false, retryAfterSec: 0 };
  try {
    const multi = client.multi();
    for (const l of limits) multi.set(k(l.key), 0, "EX", l.windowSec, "NX").incr(k(l.key)).ttl(k(l.key));
    const results = (await withTimeout(multi.exec())) ?? [];
    let blocked = false;
    let retryAfterSec = 0;
    limits.forEach((l, i) => {
      const count = Number(results[i * 3 + 1]?.[1] ?? 0);
      const ttl = Number(results[i * 3 + 2]?.[1] ?? 0);
      if (count > l.limit) {
        blocked = true;
        retryAfterSec = Math.max(retryAfterSec, ttl);
      }
    });
    return { blocked, retryAfterSec };
  } catch (err) {
    console.error("[rate-limit] failing open:", (err as Error).message);
    return { blocked: false, retryAfterSec: 0 };
  }
}

/** Check limits without counting (used before verifying a password). */
export async function isBlocked(limits: Limit[]): Promise<boolean> {
  const client = redis();
  if (!client) return false;
  try {
    const counts = await withTimeout(client.mget(...limits.map((l) => k(l.key))));
    return limits.some((l, i) => Number(counts[i] ?? 0) >= l.limit);
  } catch (err) {
    console.error("[rate-limit] failing open:", (err as Error).message);
    return false;
  }
}

export async function reset(keys: string[]): Promise<void> {
  const client = redis();
  if (!client || keys.length === 0) return;
  try {
    await withTimeout(client.del(...keys.map(k)));
  } catch {
    // best effort
  }
}

export function retryMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Per-IP limits can be scaled up for automated test runs, where every request comes from one
 * machine. Per-account limits are never scaled. Leave RATE_LIMIT_IP_MULTIPLIER unset in production.
 */
export function ipLimit(limit: number): number {
  const multiplier = Number(process.env.RATE_LIMIT_IP_MULTIPLIER ?? 1);
  return Number.isFinite(multiplier) && multiplier > 1 ? Math.round(limit * multiplier) : limit;
}

/** Limits for password sign-in: per account (stops targeted guessing) and per IP (stops spraying). */
export const loginLimits = (email: string, ip: string): Limit[] => [
  { key: `login:email:${email}`, limit: 5, windowSec: 15 * 60 },
  { key: `login:ip:${ip}`, limit: ipLimit(20), windowSec: 15 * 60 },
];
