/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests: WebStorage
 *
 * Feature: backend-stub-implementations, Property 37: Device storage CRUD round-trip
 * Feature: backend-stub-implementations, Property 38: Device storage prefix isolation
 *
 * **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createWebPlatformProvider } from '../index';
import type { DeviceStorageInterface } from '@learnverse/platform-contracts';

// --- Helpers ---

/**
 * Creates a fresh WebStorage instance via the platform provider factory.
 */
function createStorage(): DeviceStorageInterface {
  return createWebPlatformProvider().storage;
}

// --- Arbitraries ---

/**
 * Generates valid storage keys: non-empty strings that don't contain null chars.
 * We avoid null chars because localStorage doesn't handle them well across all environments.
 */
const storageKeyArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => !s.includes('\u0000') && s.trim().length > 0
);

/**
 * Generates valid storage values: arbitrary strings (can be empty).
 * We avoid null chars for the same reason as keys.
 */
const storageValueArb = fc.string({ minLength: 0, maxLength: 500 }).filter(
  (s) => !s.includes('\u0000')
);

/**
 * Generates a key-value pair for storage operations.
 */
const keyValueArb = fc.tuple(storageKeyArb, storageValueArb);

/**
 * Generates a list of unique keys with associated values.
 */
const uniqueKeyValuesArb = fc
  .uniqueArray(storageKeyArb, { minLength: 1, maxLength: 10 })
  .chain((keys) =>
    fc.tuple(
      fc.constant(keys),
      fc.array(storageValueArb, { minLength: keys.length, maxLength: keys.length })
    )
  );

// --- Property 37: Device storage CRUD round-trip ---

describe('Feature: backend-stub-implementations, Property 37: Device storage CRUD round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('for ANY key-value pair, setItem followed by getItem returns the same value', async () => {
    await fc.assert(
      fc.asyncProperty(keyValueArb, async ([key, value]) => {
        localStorage.clear();
        const storage = createStorage();

        await storage.setItem(key, value);
        const retrieved = await storage.getItem(key);

        expect(retrieved).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('for ANY key, getItem returns null if the key was never set', async () => {
    await fc.assert(
      fc.asyncProperty(storageKeyArb, async (key) => {
        localStorage.clear();
        const storage = createStorage();

        const retrieved = await storage.getItem(key);

        expect(retrieved).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('for ANY key-value pair, after setItem then removeItem, getItem returns null', async () => {
    await fc.assert(
      fc.asyncProperty(keyValueArb, async ([key, value]) => {
        localStorage.clear();
        const storage = createStorage();

        await storage.setItem(key, value);
        await storage.removeItem(key);
        const retrieved = await storage.getItem(key);

        expect(retrieved).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('for ANY sequence of key-value pairs, the last value written to a key is the one retrieved', async () => {
    await fc.assert(
      fc.asyncProperty(
        storageKeyArb,
        fc.array(storageValueArb, { minLength: 2, maxLength: 5 }),
        async (key, values) => {
          localStorage.clear();
          const storage = createStorage();

          for (const value of values) {
            await storage.setItem(key, value);
          }
          const retrieved = await storage.getItem(key);

          expect(retrieved).toBe(values[values.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 38: Device storage prefix isolation ---

describe('Feature: backend-stub-implementations, Property 38: Device storage prefix isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('for ANY mix of LearnVerse-prefixed and non-prefixed keys, clear() removes only LearnVerse-prefixed keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueKeyValuesArb,
        uniqueKeyValuesArb,
        async ([learnVerseKeys, lvValues], [externalKeys, extValues]) => {
          // Clear localStorage between iterations to avoid state leaking
          localStorage.clear();
          const storage = createStorage();

          // Store LearnVerse keys through the WebStorage API
          for (let i = 0; i < learnVerseKeys.length; i++) {
            await storage.setItem(learnVerseKeys[i], lvValues[i]);
          }

          // Store external keys directly in localStorage (simulating other apps)
          // These should NOT have the 'learnverse:' prefix
          for (let i = 0; i < externalKeys.length; i++) {
            const externalKey = `external:${externalKeys[i]}`;
            localStorage.setItem(externalKey, extValues[i]);
          }

          // Call clear - should only remove learnverse-prefixed keys
          await storage.clear();

          // Verify LearnVerse keys are gone
          for (const key of learnVerseKeys) {
            const result = await storage.getItem(key);
            expect(result).toBeNull();
          }

          // Verify external keys are still in localStorage
          for (let i = 0; i < externalKeys.length; i++) {
            const externalKey = `external:${externalKeys[i]}`;
            expect(localStorage.getItem(externalKey)).toBe(extValues[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for ANY mix of LearnVerse-prefixed and non-prefixed keys, getAllKeys() returns only LearnVerse-prefixed keys (without prefix)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueKeyValuesArb,
        uniqueKeyValuesArb,
        async ([learnVerseKeys, lvValues], [externalKeys, extValues]) => {
          // Clear localStorage between iterations to avoid state leaking
          localStorage.clear();
          const storage = createStorage();

          // Store LearnVerse keys through the WebStorage API
          for (let i = 0; i < learnVerseKeys.length; i++) {
            await storage.setItem(learnVerseKeys[i], lvValues[i]);
          }

          // Store external keys directly in localStorage
          for (let i = 0; i < externalKeys.length; i++) {
            const externalKey = `external:${externalKeys[i]}`;
            localStorage.setItem(externalKey, extValues[i]);
          }

          // getAllKeys should return only LearnVerse keys (without prefix)
          const allKeys = await storage.getAllKeys();

          // All LearnVerse keys should be present
          for (const key of learnVerseKeys) {
            expect(allKeys).toContain(key);
          }

          // No external keys should appear (they don't have 'learnverse:' prefix)
          for (const key of externalKeys) {
            const externalKey = `external:${key}`;
            expect(allKeys).not.toContain(externalKey);
          }

          // The count should match the number of LearnVerse keys
          expect(allKeys.length).toBe(learnVerseKeys.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('setItem stores with learnverse: prefix in raw localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(keyValueArb, async ([key, value]) => {
        localStorage.clear();
        const storage = createStorage();

        await storage.setItem(key, value);

        // The raw localStorage key should be prefixed
        const rawValue = localStorage.getItem(`learnverse:${key}`);
        expect(rawValue).toBe(value);
      }),
      { numRuns: 100 }
    );
  });
});
