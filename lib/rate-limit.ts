import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Rate limiting for login, invites, sending and public endpoints.
 *
 * Production uses Upstash Redis (shared across all serverless instances).
 * If Upstash isn't configured we fall back to an in-memory counter, which is
 * fine for local development but NOT sufficient in production.
 */

type Rule = { limit: number; windowSeconds: number };

export const RULES = {
  login: { limit: 10, windowSeconds: 60 },
  invite: { limit: 10, windowSeconds: 60 * 10 },
  send: { limit: 30, windowSeconds: 60 },
  publicRating: { limit: 30, windowSeconds: 60 },
  publicForm: { limit: 5, windowSeconds: 60 * 10 },
  webhook: { limit: 600, windowSeconds: 60 },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

// The Vercel Marketplace integration names these KV_REST_API_*; Upstash's own docs use UPSTASH_REDIS_REST_*.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const limiters = new Map<RuleName, Ratelimit>();

function upstashLimiter(name: RuleName) {
  let limiter = limiters.get(name);
  if (!limiter) {
    const rule = RULES[name];
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
      prefix: `rl:${name}`,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

// Simple fixed-window fallback for local dev.
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(name: RuleName, key: string) {
  const rule = RULES[name];
  const id = `${name}:${key}`;
  const now = Date.now();
  const entry = memory.get(id);
  if (!entry || entry.resetAt < now) {
    memory.set(id, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= rule.limit;
}

/** Returns true if the request is allowed. */
export async function rateLimit(name: RuleName, key: string): Promise<boolean> {
  if (process.env.DISABLE_RATE_LIMIT === "1") return true;
  if (redis) {
    const { success } = await upstashLimiter(name).limit(key);
    return success;
  }
  return memoryLimit(name, key);
}

/** Best-effort client IP from Vercel / proxy headers. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Rate limit by the caller's IP (for public endpoints). */
export async function rateLimitByIp(name: RuleName, extra = "") {
  const ip = await clientIp();
  return rateLimit(name, `${ip}${extra ? `:${extra}` : ""}`);
}

/**
 * Better Auth custom storage, so login rate limits are shared across instances
 * when Redis is available. Fixed window: INCR the key, set expiry on first hit.
 */
export const authRateLimitStorage = redis
  ? {
      consume: async (key: string, rule: { window: number; max: number }) => {
        const redisKey = `rl:auth:${key}`;
        const [count, ttl] = await redis.pipeline().incr(redisKey).ttl(redisKey).exec<[number, number]>();
        if (ttl < 0) await redis.expire(redisKey, rule.window);
        const allowed = count <= rule.max;
        return { allowed, retryAfter: allowed ? null : Math.max(ttl, 1) };
      },
    }
  : undefined;
