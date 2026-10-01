import { redis } from '../../config/redis';
import { logger } from '../../config/logger';

/**
 * TTL-based caching service.
 * Primary: Redis (if connected). Fallback: in-memory Map.
 * All values are JSON-serialized strings.
 */

// In-memory fallback store
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

// Default TTLs in seconds
export const CacheTTL = {
  PROFILE: 300,       // 5 minutes
  CONTEST: 600,       // 10 minutes
  CONTEST_PROBLEMS: 600,
  STUDENT_DATA: 300,
} as const;

let redisAvailable = true;

// Probe redis availability once
redis.ping().catch(() => {
  redisAvailable = false;
  logger.warn('Redis unavailable — using in-memory cache fallback');
});

redis.on('error', () => {
  redisAvailable = false;
});
redis.on('connect', () => {
  redisAvailable = true;
});

/**
 * Retrieve a cached value by key.
 * Returns null if key doesn't exist or has expired.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    if (redisAvailable) {
      const raw = await redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    }
  } catch {
    // fall through to memory cache
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

/**
 * Store a value with TTL.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const raw = JSON.stringify(value);
  try {
    if (redisAvailable) {
      await redis.set(key, raw, 'EX', ttlSeconds);
      return;
    }
  } catch {
    // fall through to memory cache
  }

  // In-memory fallback
  memoryCache.set(key, {
    value: raw,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Remove a single cached key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  try {
    if (redisAvailable) {
      await redis.del(key);
    }
  } catch {
    // ignore
  }
  memoryCache.delete(key);
}

/**
 * Remove keys matching a glob pattern (Redis) or prefix (memory).
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    if (redisAvailable) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch {
    // ignore
  }

  // In-memory: treat pattern as prefix (strip trailing *)
  const prefix = pattern.replace(/\*$/, '');
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}
