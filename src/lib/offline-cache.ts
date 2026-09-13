import AsyncStorage from "@react-native-async-storage/async-storage";

// Offline cache is multi-tier:
// 1. RAM / In-Memory Map (0ms synchronous reads, instant tab switches)
// 2. AsyncStorage (Persistent storage across app launches)
// 3. Stale-While-Revalidate (Instant display of cached data + background refresh)
export const CACHE_PREFIX = "vaqtda.cache.v1.";

// Standard TTL presets (milliseconds)
export const TTL_STATIC = 24 * 60 * 60 * 1000;    // 24 hours: categories, regions
export const TTL_CONFIG = 12 * 60 * 60 * 1000;    // 12 hours: category booking modes
export const TTL_SERVICES = 15 * 60 * 1000;       // 15 minutes: services, staff list
export const TTL_PROFILE = 10 * 60 * 1000;        // 10 minutes: provider profile, staff role
export const TTL_WALLET = 5 * 60 * 1000;          // 5 minutes: wallet balance
export const TTL_DYNAMIC = 2 * 60 * 1000;         // 2 minutes: appointments, waitlists, queues

export interface CacheEntry<T> {
  savedAt: number;
  ttl?: number;
  value: T;
}

// L1: In-Memory Map for 0ms ultra-fast synchronous reads
const memoryCache = new Map<string, CacheEntry<unknown>>();

// In-flight promise deduplication to prevent duplicate concurrent network requests
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Synchronously reads an entry from the in-memory RAM cache.
 * Returns null if not cached or expired (unless allowStale is true).
 */
export function getMemoryCache<T>(key: string, allowStale = true): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (!allowStale && entry.ttl && Date.now() - entry.savedAt > entry.ttl) {
    return null;
  }
  return entry.value;
}

/**
 * Synchronously writes an entry to the in-memory RAM cache.
 */
export function setMemoryCache<T>(key: string, value: T, ttl?: number): void {
  memoryCache.set(key, {
    savedAt: Date.now(),
    ttl,
    value,
  });
}

/**
 * Checks if a key exists in memory cache and is still fresh (not expired).
 */
export function isMemoryCacheFresh(key: string): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return false;
  if (entry.ttl && Date.now() - entry.savedAt > entry.ttl) return false;
  return true;
}

/**
 * Removes an entry from in-memory RAM cache.
 */
export function removeMemoryCache(key: string): void {
  memoryCache.delete(key);
}

/**
 * Reads from cache: checks memory first, then AsyncStorage.
 * Auto-hydrates memory cache if found on disk.
 */
export async function readCache<T>(key: string, allowStale = true): Promise<T | null> {
  // 1. Check L1 Memory
  const memValue = getMemoryCache<T>(key, allowStale);
  if (memValue !== null) {
    return memValue;
  }

  // 2. Check L2 Disk
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || !("value" in parsed)) return null;

    // Check expiration if not allowing stale
    if (!allowStale && parsed.ttl && Date.now() - parsed.savedAt > parsed.ttl) {
      return null;
    }

    // Hydrate L1 memory cache for subsequent instant reads
    memoryCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

/**
 * Writes data to both in-memory cache and persistent AsyncStorage.
 */
export async function writeCache<T>(key: string, value: T, ttl?: number): Promise<void> {
  // Write to memory immediately (synchronous)
  setMemoryCache(key, value, ttl);

  // Write to disk in background (best effort)
  try {
    const record: CacheEntry<T> = {
      savedAt: Date.now(),
      ttl,
      value,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(record));
  } catch {
    // Storage can be unavailable on low-disk devices; memory data remains active.
  }
}

/**
 * Removes an entry from both memory and disk cache.
 */
export async function removeCache(key: string): Promise<void> {
  removeMemoryCache(key);
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // Best effort only.
  }
}

/**
 * Invalidates (deletes) all cached items matching a pattern or prefix.
 * e.g. invalidateCache("appointments.") or invalidateCache(/^provider\./)
 */
export async function invalidateCache(pattern: string | RegExp): Promise<void> {
  const isMatch = (k: string) =>
    typeof pattern === "string" ? k.startsWith(pattern) || k.includes(pattern) : pattern.test(k);

  // 1. Clear matching from memory
  for (const k of memoryCache.keys()) {
    if (isMatch(k)) {
      memoryCache.delete(k);
    }
  }

  // 2. Clear matching from disk
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter((k) => {
      if (!k.startsWith(CACHE_PREFIX)) return false;
      const stripped = k.slice(CACHE_PREFIX.length);
      return isMatch(stripped);
    });
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // Best effort
  }
}

/**
 * Clears all cache entries across memory and disk.
 */
export async function clearAllCache(): Promise<void> {
  memoryCache.clear();
  inFlightRequests.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Best effort only.
  }
}

export interface SwrFetchOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  onBackgroundUpdate?: (fresh: T) => void;
}

/**
 * Executes an SWR (Stale-While-Revalidate) fetch:
 * 1. Returns cached value immediately if present.
 * 2. Revalidates from network in background (or foreground if no cache).
 * 3. Deduplicates concurrent requests for the same key.
 */
export async function swrFetch<T>({
  key,
  fetcher,
  ttl = TTL_DYNAMIC,
  onBackgroundUpdate,
}: SwrFetchOptions<T>): Promise<{ data: T; fromCache: boolean }> {
  // Deduplicate fetcher promise
  const executeFetcher = (): Promise<T> => {
    let activePromise = inFlightRequests.get(key) as Promise<T> | undefined;
    if (!activePromise) {
      activePromise = fetcher()
        .then(async (fresh) => {
          await writeCache(key, fresh, ttl);
          return fresh;
        })
        .finally(() => {
          inFlightRequests.delete(key);
        });
      inFlightRequests.set(key, activePromise);
    }
    return activePromise;
  };

  // 1. Check memory / disk cache
  const cached = await readCache<T>(key, true);
  const isFresh = isMemoryCacheFresh(key);

  if (cached !== null) {
    if (isFresh) {
      return { data: cached, fromCache: true };
    }

    // Stale: trigger background revalidation without blocking UI
    executeFetcher()
      .then((fresh) => {
        if (onBackgroundUpdate) {
          onBackgroundUpdate(fresh);
        }
      })
      .catch((err) => {
        // Background revalidation failure shouldn't throw to caller
        console.warn(`[Cache] background revalidation failed for ${key}:`, err);
      });

    return { data: cached, fromCache: true };
  }

  // 2. No cache: fetch synchronously
  const fresh = await executeFetcher();
  return { data: fresh, fromCache: false };
}
