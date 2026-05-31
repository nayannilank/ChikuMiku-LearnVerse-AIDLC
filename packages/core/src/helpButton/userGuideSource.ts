/**
 * UserGuideSource
 *
 * Orchestrates content loading with platform-aware strategy.
 *
 * - Web: online-first strategy with caching. Fetches the static HTML user guide
 *   file and caches it on success. When offline, serves from cache if available,
 *   otherwise shows an informational message.
 * - Android: reads from the bundled `assets/user_guide.html` asset, which is
 *   always available regardless of network state (bundled in APK).
 *
 * Includes timeout, retry with exponential backoff, and offline support (web).
 */

import type { LoadResult } from './types';

/** Cache interface for user guide HTML content */
export interface UserGuideCache {
  /** Get cached HTML content, or null if not cached */
  get(): string | null;
  /** Store HTML content in cache, replacing any previous version */
  set(content: string): void;
  /** Check if cached content exists */
  has(): boolean;
  /** Clear cached content */
  clear(): void;
}

/** Supported platform types */
export type Platform = 'web' | 'android';

/**
 * Interface for reading bundled assets on native platforms.
 * On Android, this reads from the APK's `assets/` directory.
 */
export interface AssetLoader {
  /** Read a bundled asset file and return its content as a string */
  readAsset(path: string): Promise<string>;
}

/** Options for creating a UserGuideSource instance */
export interface UserGuideSourceOptions {
  /** Cache instance for storing/retrieving HTML content */
  cache: UserGuideCache;
  /** Platform the app is running on (defaults to 'web') */
  platform?: Platform;
  /** Asset loader for reading bundled files on native platforms (required when platform is 'android') */
  assetLoader?: AssetLoader;
  /** Path to the bundled asset file on Android (defaults to 'user_guide.html') */
  bundledAssetPath?: string;
  /** Custom fetch function (defaults to global fetch). Useful for testing. */
  fetchFn?: typeof fetch;
  /** URL path to the static HTML file (defaults to '/user-guide.html') */
  htmlPath?: string;
  /** Timeout in milliseconds for fetch operations (defaults to 2000) */
  timeoutMs?: number;
  /** Maximum number of automatic retries (defaults to 3) */
  maxRetries?: number;
  /** Custom online check function (defaults to navigator.onLine). Useful for testing. */
  isOnlineFn?: () => boolean;
}

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_HTML_PATH = '/user-guide.html';
const DEFAULT_BUNDLED_ASSET_PATH = 'user_guide.html';

/** Base delays for exponential backoff: 1s, 2s, 4s */
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

/**
 * Creates a promise that rejects after the specified timeout.
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Content load timeout')), ms);
  });
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * UserGuideSource implementation.
 *
 * Provides platform-aware loading of the user guide HTML content:
 *
 * **Web platform:**
 * - Online-first strategy: fetches fresh content when online, caches on success
 * - Falls back to cache when online fetch fails or when offline
 * - 2-second timeout for fetch operations
 * - Exponential backoff retry (1s, 2s, 4s delays, max 3 automatic retries)
 * - Offline detection with appropriate error messages
 * - If offline and no cache exists, displays informational message
 *
 * **Android platform:**
 * - Reads from bundled `assets/user_guide.html` (always available, no network needed)
 * - Content is bundled in the APK, so offline is never an issue
 * - No caching needed (asset is always present)
 */
export class UserGuideSourceImpl {
  private readonly cache: UserGuideCache;
  private readonly platform: Platform;
  private readonly assetLoader?: AssetLoader;
  private readonly bundledAssetPath: string;
  private readonly fetchFn: typeof fetch;
  private readonly htmlPath: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly isOnlineFn: () => boolean;

  constructor(options: UserGuideSourceOptions) {
    this.cache = options.cache;
    this.platform = options.platform ?? 'web';
    this.assetLoader = options.assetLoader;
    this.bundledAssetPath = options.bundledAssetPath ?? DEFAULT_BUNDLED_ASSET_PATH;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.htmlPath = options.htmlPath ?? DEFAULT_HTML_PATH;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.isOnlineFn = options.isOnlineFn ?? (() => globalThis.navigator?.onLine ?? true);
  }

  /**
   * Check if the device is currently online.
   * On Android, this always returns true since content is bundled locally.
   */
  isOnline(): boolean {
    if (this.platform === 'android') {
      return true;
    }
    return this.isOnlineFn();
  }

  /**
   * Load user guide HTML content using a platform-aware strategy.
   *
   * **Android path:**
   * - Reads directly from the bundled asset (always available)
   * - No network dependency, no caching needed
   *
   * **Web path:**
   * 1. Check if the device is online.
   * 2. If online: fetch the static HTML with timeout and retry logic.
   *    On success, cache the content (replacing any previous version) and return it.
   *    On failure after all retries, fall back to cache if available, otherwise return error.
   * 3. If offline: serve from cache if available.
   *    If no cache exists, return an informational error message.
   */
  async load(): Promise<LoadResult> {
    if (this.platform === 'android') {
      return this.loadFromBundledAsset();
    }

    return this.loadFromWeb();
  }

  /**
   * Load content from the Android bundled asset.
   * The content is always available since it's packaged in the APK.
   */
  private async loadFromBundledAsset(): Promise<LoadResult> {
    if (!this.assetLoader) {
      return {
        status: 'error',
        message: "The User Guide couldn't be loaded. Tap Retry to try again.",
        canRetry: true,
      };
    }

    try {
      const content = await this.assetLoader.readAsset(this.bundledAssetPath);

      if (!content || content.trim().length === 0) {
        return {
          status: 'error',
          message: "The User Guide couldn't be loaded. Tap Retry to try again.",
          canRetry: true,
        };
      }

      return { status: 'success', content, fromCache: false };
    } catch {
      return {
        status: 'error',
        message: "The User Guide couldn't be loaded. Tap Retry to try again.",
        canRetry: true,
      };
    }
  }

  /**
   * Load content using the web strategy (online-first with cache fallback).
   */
  private async loadFromWeb(): Promise<LoadResult> {
    if (this.isOnlineFn()) {
      // Online: fetch fresh content
      const result = await this.fetchWithRetry();
      if (result.status === 'success') {
        return result;
      }

      // Fetch failed after retries — fall back to cache if available
      const cached = this.cache.get();
      if (cached !== null) {
        return { status: 'success', content: cached, fromCache: true };
      }

      // No cache available either — return the fetch error
      return result;
    }

    // Offline: serve from cache if available
    if (this.cache.has()) {
      const cached = this.cache.get();
      if (cached !== null) {
        return { status: 'success', content: cached, fromCache: true };
      }
    }

    // Offline with no cache: show informational message
    return {
      status: 'error',
      message:
        "The User Guide is available after you've used the app online at least once.",
      canRetry: false,
    };
  }

  /**
   * Fetch the HTML content with automatic retries and exponential backoff.
   * Each fetch attempt has a 2-second timeout.
   */
  private async fetchWithRetry(): Promise<LoadResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Wait before retrying (no delay on first attempt)
      if (attempt > 0) {
        const backoffDelay = BACKOFF_DELAYS_MS[attempt - 1] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
        await delay(backoffDelay);
      }

      // Check if we went offline during retries
      if (attempt > 0 && !this.isOnlineFn()) {
        return {
          status: 'error',
          message:
            "The User Guide couldn't be loaded. Tap Retry to try again.",
          canRetry: true,
        };
      }

      try {
        const content = await this.fetchWithTimeout();
        // Success: cache the content and return
        this.cache.set(content);
        return { status: 'success', content, fromCache: false };
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // All retries exhausted
    return {
      status: 'error',
      message: "The User Guide couldn't be loaded. Tap Retry to try again.",
      canRetry: true,
    };
  }

  /**
   * Fetch the HTML file with a timeout.
   * Rejects if the fetch takes longer than the configured timeout.
   */
  private async fetchWithTimeout(): Promise<string> {
    const response = await Promise.race([
      this.fetchFn(this.htmlPath),
      createTimeout(this.timeoutMs),
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new Error('Empty or corrupt HTML content');
    }

    return content;
  }
}
