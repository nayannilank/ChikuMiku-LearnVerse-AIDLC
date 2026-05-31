/**
 * Client-side caching module.
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
}

/** Cache configuration */
export interface CacheConfig {
  /** Maximum cache size in bytes (default: 500 MB) */
  maxSizeBytes: number;
  /** Expiration period in days since last access (default: 7) */
  expirationDays: number;
}

/** Cache statistics */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  hitCount: number;
  missCount: number;
}

// --- Constants ---

/** Default max cache size: 500 MB */
export const DEFAULT_MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024;

/** Default expiration: 7 days */
export const DEFAULT_EXPIRATION_DAYS = 7;

// --- ClientCache Class ---

/**
 * ClientCache implements LRU caching with size limits and time-based expiration.
 *
 * Content is cached after being accessed more than once per session.
 * When the cache exceeds the max size, the least recently accessed items are evicted.
 * Items not accessed for more than 7 days are expired.
 */
export class ClientCache {
  private entries: Map<string, CacheEntry> = new Map();
  private sessionAccessCounts: Map<string, number> = new Map();
  private config: CacheConfig;
  private hitCount = 0;
  private missCount = 0;
  private currentTime: (() => Date) | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSizeBytes: config?.maxSizeBytes ?? DEFAULT_MAX_CACHE_SIZE_BYTES,
      expirationDays: config?.expirationDays ?? DEFAULT_EXPIRATION_DAYS,
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
   * Record an access to a content key. Content is only cached after
   * being accessed more than once in the current session.
   *
   * Returns true if the content was cached (or already in cache).
   */
  access(key: string, data: unknown, sizeBytes: number): boolean {
    // Increment session access count
    const count = (this.sessionAccessCounts.get(key) ?? 0) + 1;
    this.sessionAccessCounts.set(key, count);

    // If already cached, update access time
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastAccessedAt = this.now();
      existing.accessCount += 1;
      this.hitCount++;
      return true;
    }

    // Only cache after accessed more than once per session
    if (count < 2) {
      this.missCount++;
      return false;
    }

    // Cache the content
    this.putEntry(key, data, sizeBytes);
    this.hitCount++;
    return true;
  }

  /**
   * Retrieve a cached entry by key.
   * Returns null if not found or expired.
   */
  get(key: string): unknown | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      this.missCount++;
      return null;
    }

    // Update access time
    entry.lastAccessedAt = this.now();
    entry.accessCount += 1;
    this.hitCount++;
    return entry.data;
  }

  /**
   * Check if a key exists in the cache and is not expired.
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove a specific entry from the cache.
   */
  remove(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Clear all cached entries and reset session access counts.
   */
  clear(): void {
    this.entries.clear();
    this.sessionAccessCounts.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Reset session access counts (e.g., when a new session starts).
   */
  resetSession(): void {
    this.sessionAccessCounts.clear();
  }

  /**
   * Get the current total size of cached content in bytes.
   */
  getTotalSize(): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      total += entry.sizeBytes;
    }
    return total;
  }

  /**
   * Get the number of entries in the cache.
   */
  getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return {
      totalEntries: this.entries.size,
      totalSizeBytes: this.getTotalSize(),
      maxSizeBytes: this.config.maxSizeBytes,
      hitCount: this.hitCount,
      missCount: this.missCount,
    };
  }

  /**
   * Remove all expired entries from the cache.
   * Returns the number of entries removed.
   */
  purgeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get all cache entries (for inspection/testing).
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.entries.values());
  }

  // --- Private Methods ---

  /**
   * Put an entry into the cache, evicting LRU items if necessary.
   */
  private putEntry(key: string, data: unknown, sizeBytes: number): void {
    // If the single item exceeds max size, don't cache it
    if (sizeBytes > this.config.maxSizeBytes) {
      return;
    }

    // Evict expired entries first
    this.purgeExpired();

    // Evict LRU entries until there's room
    while (this.getTotalSize() + sizeBytes > this.config.maxSizeBytes) {
      this.evictLRU();
      if (this.entries.size === 0) break;
    }

    // If still not enough room after evicting everything, skip
    if (this.getTotalSize() + sizeBytes > this.config.maxSizeBytes) {
      return;
    }

    const entry: CacheEntry = {
      key,
      data,
      sizeBytes,
      lastAccessedAt: this.now(),
      accessCount: 1,
    };

    this.entries.set(key, entry);
  }

  /**
   * Evict the least recently accessed entry.
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime: Date | null = null;

    for (const [key, entry] of this.entries) {
      if (lruTime === null || entry.lastAccessedAt < lruTime) {
        lruKey = key;
        lruTime = entry.lastAccessedAt;
      }
    }

    if (lruKey) {
      this.entries.delete(lruKey);
    }
  }

  /**
   * Check if an entry has expired (not accessed for more than expirationDays).
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = this.now();
    const expirationMs = this.config.expirationDays * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - entry.lastAccessedAt.getTime();
    return elapsed > expirationMs;
  }
}
