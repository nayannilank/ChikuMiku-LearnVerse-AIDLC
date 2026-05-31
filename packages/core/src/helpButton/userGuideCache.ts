/**
 * UserGuideCache
 *
 * Implements caching of the User Guide HTML content using localStorage.
 * Stores content with a timestamp and version hash for change detection.
 * Handles errors gracefully (e.g., localStorage not available, quota exceeded).
 */

import type { UserGuideCacheEntry } from './types';

/** localStorage key for the cached user guide HTML */
const STORAGE_KEY = 'chikumiku:user-guide:html';

/**
 * Generate a simple hash string from content for change detection.
 * Uses a basic djb2-style hash — sufficient for detecting content changes.
 */
function generateHash(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Cache interface for user guide HTML content */
export interface IUserGuideCache {
  /** Get cached HTML content, or null if not cached */
  get(): string | null;
  /** Store HTML content in cache, replacing any previous version */
  set(content: string): void;
  /** Check if cached content exists */
  has(): boolean;
  /** Clear cached content */
  clear(): void;
}

/**
 * UserGuideCache implementation using localStorage.
 *
 * Stores the user guide HTML content with metadata (timestamp and version hash)
 * under the key `chikumiku:user-guide:html`. All operations are wrapped in
 * try/catch to handle environments where localStorage is unavailable or full.
 */
export class UserGuideCache implements IUserGuideCache {
  /**
   * Get cached HTML content, or null if not cached or on error.
   */
  get(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      const entry: UserGuideCacheEntry = JSON.parse(raw);
      return entry.content;
    } catch {
      return null;
    }
  }

  /**
   * Store HTML content in cache, replacing any previous version.
   * Generates a version hash and records the current timestamp.
   * Silently fails if localStorage is unavailable or quota is exceeded.
   */
  set(content: string): void {
    try {
      const entry: UserGuideCacheEntry = {
        content,
        cachedAt: Date.now(),
        version: generateHash(content),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Silently handle errors (quota exceeded, localStorage unavailable, etc.)
    }
  }

  /**
   * Check if cached content exists and is parseable.
   */
  has(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return false;
      }
      const entry: UserGuideCacheEntry = JSON.parse(raw);
      return typeof entry.content === 'string' && entry.content.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Clear cached content from localStorage.
   * Silently fails if localStorage is unavailable.
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently handle errors
    }
  }
}
