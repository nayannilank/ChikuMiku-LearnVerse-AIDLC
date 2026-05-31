/**
 * Tiered Storage Migration module.
 *
 * Implements Task 15.3:
 * - Hot storage for content accessed within 30 days
 * - Cold storage for content not accessed for 30+ days
 *
 * Validates: Requirements 12.3
 */

// --- Types ---

/** Storage tier classification */
export type StorageTier = 'hot' | 'cold';

/** A stored content item with tier metadata */
export interface StoredItem {
  id: string;
  contentType: string;
  sizeBytes: number;
  lastAccessedAt: Date;
  createdAt: Date;
  tier: StorageTier;
}

/** Tiered storage configuration */
export interface TieredStorageConfig {
  /** Number of days after which content moves to cold storage (default: 30) */
  hotStorageThresholdDays: number;
}

/** Migration result for a batch operation */
export interface MigrationResult {
  migratedToCold: string[];
  migratedToHot: string[];
  unchanged: string[];
}

// --- Constants ---

/** Default threshold: 30 days */
export const DEFAULT_HOT_STORAGE_THRESHOLD_DAYS = 30;

// --- TieredStorage Class ---

/**
 * TieredStorage manages content across hot and cold storage tiers.
 *
 * - Hot storage: content accessed within the last 30 days (high-performance)
 * - Cold storage: content not accessed for 30+ days (lower-cost)
 *
 * When content is accessed, it is promoted back to hot storage.
 * A migration process periodically moves stale content to cold storage.
 */
export class TieredStorage {
  private items: Map<string, StoredItem> = new Map();
  private config: TieredStorageConfig;
  private currentTime: (() => Date) | null = null;

  constructor(config?: Partial<TieredStorageConfig>) {
    this.config = {
      hotStorageThresholdDays:
        config?.hotStorageThresholdDays ?? DEFAULT_HOT_STORAGE_THRESHOLD_DAYS,
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
   * Store a new content item. New items always start in hot storage.
   */
  store(id: string, contentType: string, sizeBytes: number): StoredItem {
    const now = this.now();
    const item: StoredItem = {
      id,
      contentType,
      sizeBytes,
      lastAccessedAt: now,
      createdAt: now,
      tier: 'hot',
    };
    this.items.set(id, item);
    return { ...item };
  }

  /**
   * Access a stored item. Updates lastAccessedAt and promotes to hot if in cold.
   * Returns null if item not found.
   */
  access(id: string): StoredItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    item.lastAccessedAt = this.now();

    // Promote to hot storage on access
    if (item.tier === 'cold') {
      item.tier = 'hot';
    }

    return { ...item };
  }

  /**
   * Get an item without updating its access time (for inspection).
   */
  getItem(id: string): StoredItem | null {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  /**
   * Determine the correct tier for an item based on its last access time.
   */
  determineTier(lastAccessedAt: Date): StorageTier {
    const now = this.now();
    const thresholdMs = this.config.hotStorageThresholdDays * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - lastAccessedAt.getTime();

    // Content accessed within 0 to (threshold-1) days is hot
    // Content not accessed for threshold+ days is cold
    return elapsed >= thresholdMs ? 'cold' : 'hot';
  }

  /**
   * Run the migration process: move items to the correct tier based on access time.
   * Returns a summary of what was migrated.
   */
  runMigration(): MigrationResult {
    const result: MigrationResult = {
      migratedToCold: [],
      migratedToHot: [],
      unchanged: [],
    };

    for (const item of this.items.values()) {
      const correctTier = this.determineTier(item.lastAccessedAt);

      if (item.tier !== correctTier) {
        if (correctTier === 'cold') {
          result.migratedToCold.push(item.id);
        } else {
          result.migratedToHot.push(item.id);
        }
        item.tier = correctTier;
      } else {
        result.unchanged.push(item.id);
      }
    }

    return result;
  }

  /**
   * Get all items in a specific tier.
   */
  getItemsByTier(tier: StorageTier): StoredItem[] {
    const items: StoredItem[] = [];
    for (const item of this.items.values()) {
      if (item.tier === tier) {
        items.push({ ...item });
      }
    }
    return items;
  }

  /**
   * Get the count of items in each tier.
   */
  getTierCounts(): { hot: number; cold: number } {
    let hot = 0;
    let cold = 0;
    for (const item of this.items.values()) {
      if (item.tier === 'hot') hot++;
      else cold++;
    }
    return { hot, cold };
  }

  /**
   * Get total size in bytes for each tier.
   */
  getTierSizes(): { hot: number; cold: number } {
    let hot = 0;
    let cold = 0;
    for (const item of this.items.values()) {
      if (item.tier === 'hot') hot += item.sizeBytes;
      else cold += item.sizeBytes;
    }
    return { hot, cold };
  }

  /**
   * Remove an item from storage.
   */
  remove(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * Get all stored items.
   */
  getAllItems(): StoredItem[] {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }

  /**
   * Clear all stored items.
   */
  clear(): void {
    this.items.clear();
  }
}
