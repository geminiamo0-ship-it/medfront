import { Cache } from 'cache-manager';
import { Logger } from '@nestjs/common';

// Graceful-degradation wrappers around cache-manager. If Redis is down or
// the call fails for any reason, we log once and behave like a cache miss —
// the surrounding code falls through to the source of truth (DB) instead
// of returning 500s to the user.
//
// Why this matters: cache-manager / Keyv throws on connection failures.
// Without these wrappers, every cached endpoint (filter counts, taxonomy,
// explanations, app settings) returns 500 when Redis blips. With them,
// the site keeps serving correct (uncached) responses — slower, but alive.

const logger = new Logger('SafeCache');

export async function safeCacheGet<T>(
  cache: Cache,
  key: string,
): Promise<T | undefined> {
  try {
    const value = await cache.get<T>(key);
    return value ?? undefined;
  } catch (error) {
    logger.warn(
      `Cache GET failed for ${key}: ${error instanceof Error ? error.message : error}`,
    );
    return undefined;
  }
}

export async function safeCacheSet(
  cache: Cache,
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  try {
    await cache.set(key, value, ttlMs);
  } catch (error) {
    logger.warn(
      `Cache SET failed for ${key}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export async function safeCacheDel(
  cache: Cache,
  key: string,
): Promise<void> {
  try {
    await cache.del(key);
  } catch (error) {
    logger.warn(
      `Cache DEL failed for ${key}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
