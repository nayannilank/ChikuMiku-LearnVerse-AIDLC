/**
 * Client-Side Caching module.
 *
 * Implements Task 15.1:
 * - Cache content accessed more than once per session
 * - Max 500 MB per device, 7-day expiration since last access
 * - LRU eviction when size limit exceeded
 *
 * Validates: Requirements 12.2
 */

// --- Types ---

/** A cached content entry */
export interface CacheEntry {
  key: string;
  data: unknown;
  sizeBytes: number;
  lastAccessedAt: Date;
  accessCount: number;
  createdAt: Date;
}

/** Client cache configuration */
export interface ClientCacheConfig {
  /** Maximum cache size in bytes (default: 500 MB) */
  maxSizeBytes: number;
  /** Expiration period in days since last access (default: 7) */
  expirationDays: number;
  /** Minimum access count before caching (default: 2 — accessed more than once) */
  minAccessCountToCache: number;
}

/** Cache statistics */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
}

// --- Constants ---

/** Default max cache size: 500 MB */
export const DEFAULT_MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024;

/** Default expiration: 7 days */
export const DEFAULT_EXPIRATION_DAYS = 7;

/** Default minimum access count to cache: 2 (accessed more than once) */
export const DEFAULT_MIN_ACCESS_COUNT = 2;

// --- ClientCache Class ---

/**
 * ClientCache implements an LRU cache with size limits and time-based expiration.
 *
 * Content is only cached after being accessed more than once per session.
 * When the cache exceeds 500 MB, the least recently accessed items are evicted.
 * Items not accessed for more than 7 days are expired.
 */
export class ClientCache {
  private entries: Map<string, CacheEntry> = new Map();
  private accessTracker: Map<string, number> = new Map();
  private config: ClientCacheConfig;
  private currentSizeBytes = 0;
  private stats: CacheStats = {
    totalEntries: 0,
    totalSizeBytes: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
  };
  private currentTime: (() => Date) | null = null;

  constructor(config?: Partial<ClientCacheConfig>) {
    this.config = {
      maxSizeBytes: config?.maxSizeBytes ?? DEFAULT_MAX_CACHE_SIZE_BYTES,
      expirationDays: config?.expirationDays ?? DEFAULT_EXPIRATION_DAYS,
      minAccessCountToCache: config?.minAccessCountToCache ?? DEFAULT_MIN_ACCESS_COUNT,
    };
  }

  /**
   * Override the current time function for testing purposes.
   */
  setTimeProvider(provider: () => Date): void {
    this.currentTime = provider;
  }

  private now(): Date {
    return this.currentTime ? this.currentTime() : new Date();
  }

  /**
   * Record an access to a content key. If the content has been accessed
   * enough times (more than once), it becomes eligible for caching.
   * Returns the current access count for this key.
   */
  recordAccess(key: string): number {
    const count = (this.accessTracker.get(key) ?? 0) + 1;
    this.accessTracker.set(key, count);
    return count;
  }

  /**
   * Get the access count for a key in the current session.
   */
  getAccessCount(key: string): number {
    return this.accessTracker.get(key) ?? 0;
  }

  /**
   * Check if a key is eligible for caching (accessed more than once).
   */
  isEligibleForCaching(key: string): boolean {
    return (this.accessTracker.get(key) ?? 0) >= this.config.minAccessCountToCache;
  }

  /**
   * Put content into the cache. Only succeeds if the key has been accessed
   * more than once (meeting the minAccessCountToCache threshold).
   * Returns true if cached, false if not eligible or item too large.
   */
  put(key: string, data: unknown, sizeBytes: number): boolean {
    if (!this.isEligibleForCaching(key)) {
      return false;
    }

    // Single item cannot exceed max cache size
    if (sizeBytes > this.config.maxSizeBytes) {
      return false;
    }

    // If key already exists, remove old entry first
    if (this.entries.has(key)) {
      this.removeEntry(key);
    }

    // Evict expired entries first
    this.evictExpired();

    // Evict LRU entries until there's room
    while (this.currentSizeBytes + sizeBytes > this.config.maxSizeBytes) {
      const evicted = this.evictLRU();
      if (!evicted) break; // no more entries to evict
    }

    // If still not enough room after eviction, cannot cache
    if (this.currentSizeBytes + sizeBytes > this.config.maxSizeBytes) {
      return false;
    }

    const now = this.now();
    const entry: CacheEntry = {
      key,
      data,
      sizeBytes,
      lastAccessedAt: now,
      accessCount: this.accessTracker.get(key) ?? 0,
      createdAt: now,
    };

    this.entries.set(key, entry);
    this.currentSizeBytes += sizeBytes;
    this.updateStats();

    return true;
  }

  /**
   * Get content from the cache. Updates lastAccessedAt on hit.
   * Returns null on miss or if the entry has expired.
   */
  get(key: string): unknown | null {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.missCount++;
      return null;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.removeEntry(key);
      this.stats.missCount++;
      this.stats.evictionCount++;
      return null;
    }

    // Update access time (LRU tracking)
    entry.lastAccessedAt = this.now();
    entry.accessCount++;
    this.stats.hitCount++;

    return entry.data;
  }

  /**
   * Check if a key exists in the cache and is not expired.
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.removeEntry(key);
      return false;
    }
    return true;
  }

  /**
   * Remove a specific entry from the cache.
   */
  remove(key: string): boolean {
    return this.removeEntry(key);
  }

  /**
   * Evict all expired entries (not accessed for more than expirationDays).
   * Returns the number of entries evicted.
   */
  evictExpired(): number {
    let evicted = 0;
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.removeEntry(key);
        evicted++;
        this.stats.evictionCount++;
      }
    }
    return evicted;
  }

  /**
   * Evict the least recently accessed entry.
   * Returns true if an entry was evicted, false if cache is empty.
   */
  evictLRU(): boolean {
    if (this.entries.size === 0) return false;

    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.entries) {
      const accessTime = entry.lastAccessedAt.getTime();
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.removeEntry(lruKey);
      this.stats.evictionCount++;
      return true;
    }

    return false;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get the current total size of cached content in bytes.
   */
  getCurrentSizeBytes(): number {
    return this.currentSizeBytes;
  }

  /**
   * Get the number of cached entries.
   */
  getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Get all cache entries (for inspection/testing).
   */
  getAllEntries(): CacheEntry[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }

  /**
   * Clear the entire cache and reset session access tracking.
   */
  clear(): void {
    this.entries.clear();
    this.accessTracker.clear();
    this.currentSizeBytes = 0;
    this.stats = {
      totalEntries: 0,
      totalSizeBytes: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
    };
  }

  /**
   * Reset session access tracking only (simulates new session).
   */
  resetSession(): void {
    this.accessTracker.clear();
  }

  /**
   * Get the cache configuration.
   */
  getConfig(): ClientCacheConfig {
    return { ...this.config };
  }

  // --- Private Methods ---

  private isExpired(entry: CacheEntry): boolean {
    const now = this.now();
    const expirationMs = this.config.expirationDays * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - entry.lastAccessedAt.getTime();
    return elapsed > expirationMs;
  }

  private removeEntry(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.currentSizeBytes -= entry.sizeBytes;
    this.entries.delete(key);
    return true;
  }

  private updateStats(): void {
    this.stats.totalEntries = this.entries.size;
    this.stats.totalSizeBytes = this.currentSizeBytes;
  }
}
