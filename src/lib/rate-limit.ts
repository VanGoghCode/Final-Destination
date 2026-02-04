// Rate limiting utility for API routes
// Uses in-memory storage (resets on server restart)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
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
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
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
