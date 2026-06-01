// Rate limiting utility for API routes
// Uses Redis if available, falls back to in-memory storage

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (fallback when Redis unavailable)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Lazy Redis client for rate limiting
let redisPromise: Promise<{
  get: (k: string) => Promise<number | null>;
  set: (k: string, v: number, ttl: number) => Promise<void>;
} | null> | null = null;

async function getRedisRateLimiter() {
  if (redisPromise !== null) return redisPromise;
  redisPromise = (async () => {
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        // Use Upstash Redis REST API directly (avoids extra dep)
        const base = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        return {
          async get(key: string) {
            const res = await fetch(`${base}/get/${key}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as { result: string | null };
            return data.result ? Number(data.result) : null;
          },
          async set(key: string, value: number, ttl: number) {
            await fetch(`${base}/set/${key}/${value}/ex/${ttl}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          },
        };
      }
      return null;
    } catch {
      return null;
    }
  })();
  return redisPromise;
}

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number; // Seconds until rate limit resets
}

/**
 * Check if a request should be rate limited (in-memory fallback).
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanupOldEntries();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // If no entry or entry has expired, create new entry
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if rate limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Check rate limit using Redis if available, otherwise fall back to in-memory.
 * Redis-backed rate limiting survives server restarts and works across instances.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = await getRedisRateLimiter();
  if (!redis) return checkRateLimit(identifier, config);

  const now = Date.now();
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const redisKey = `rl:${identifier}`;

  try {
    const current = await redis.get(redisKey);
    const count = current ?? 0;

    if (count >= config.maxRequests) {
      // Calculate TTL for retry-after
      // We don't know exact TTL from Redis, so estimate from window
      const retryAfter = windowSeconds;
      return {
        success: false,
        remaining: 0,
        resetTime: now + retryAfter * 1000,
        retryAfter,
      };
    }

    const newCount = count + 1;
    await redis.set(redisKey, newCount, windowSeconds);

    return {
      success: true,
      remaining: config.maxRequests - newCount,
      resetTime: now + windowSeconds * 1000,
    };
  } catch {
    // Redis error — fall back to in-memory
    return checkRateLimit(identifier, config);
  }
}

// Preset configurations for different API endpoints
export const RATE_LIMITS = {
  // AI generation endpoints - more restrictive
  AI_GENERATION: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  },
  // Research endpoint
  RESEARCH: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 requests per minute
  },
  // General API endpoints
  GENERAL: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 requests per minute
  },
  // LaTeX compilation
  LATEX: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 20 requests per minute
  },
} as const;

/**
 * Get client identifier from request headers
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers (for proxied requests)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0];
    if (firstIp) return firstIp.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier if no IP available
  return "anonymous";
}
