/**
 * Property Tests: Reset Token Store
 *
 * Feature: backend-stub-implementations, Property 8: Reset token generation for valid username
 * Feature: backend-stub-implementations, Property 10: Invalid reset tokens are rejected
 * Feature: backend-stub-implementations, Property 11: Reset token single-use enforcement
 *
 * **Validates: Requirements 3.1, 4.3, 4.4**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  generateResetToken,
  validateResetToken,
  consumeResetToken,
  clearResetTokenStore,
} from '../resetToken';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a valid username (5-15 chars, alphanumeric + _ + -) */
const usernameArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')
  ),
  { minLength: 5, maxLength: 15 },
);

/** Generates a valid account type */
const accountTypeArb = fc.constantFrom('parent', 'student') as fc.Arbitrary<
  'parent' | 'student'
>;

/** Generates random hex strings that are unlikely to be valid tokens */
const randomHexArb = fc.stringOf(
  fc.constantFrom(...'0123456789abcdef'.split('')),
  { minLength: 1, maxLength: 64 },
);

/** Generates UUID-shaped strings */
const uuidArb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 12, maxLength: 12 }),
  )
  .map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`);

/** Generates arbitrary strings including empty strings for invalid token testing */
const invalidTokenArb = fc.oneof(
  randomHexArb,
  uuidArb,
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 100 }),
);

// ─── Constants ────────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;
const TOLERANCE_MS = 5000; // 5 seconds tolerance for timing checks

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Reset Token Store - Property Tests', () => {
  beforeEach(() => {
    clearResetTokenStore();
  });

  // Feature: backend-stub-implementations, Property 8: Reset token generation for valid username
  describe('Property 8: Reset token generation for valid username', () => {
    it('for any valid username and account type, generateResetToken returns a 64-char hex string and validateResetToken returns a correct entry', () => {
      fc.assert(
        fc.property(usernameArb, accountTypeArb, (username, accountType) => {
          const token = generateResetToken(username, accountType);

          // Token should be a 64-character hex string (32 bytes)
          expect(token).toHaveLength(64);
          expect(token).toMatch(/^[0-9a-f]{64}$/);

          // validateResetToken should return a valid entry
          const entry = validateResetToken(token);
          expect(entry).not.toBeNull();

          if (entry) {
            expect(entry.username).toBe(username);
            expect(entry.accountType).toBe(accountType);
            expect(entry.used).toBe(false);
            expect(entry.token).toBe(token);

            // expiresAt should be approximately 1 hour from now
            const expectedExpiry = Date.now() + ONE_HOUR_MS;
            const actualExpiry = entry.expiresAt.getTime();
            expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(TOLERANCE_MS);
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  // Feature: backend-stub-implementations, Property 10: Invalid reset tokens are rejected
  describe('Property 10: Invalid reset tokens are rejected', () => {
    it('for any string that has not been generated as a token, validateResetToken returns null', () => {
      fc.assert(
        fc.property(invalidTokenArb, (randomToken) => {
          // No tokens have been generated (store is cleared in beforeEach)
          const result = validateResetToken(randomToken);
          expect(result).toBeNull();
        }),
        { numRuns: 200 },
      );
    });

    it('for any random string alongside generated tokens, validateResetToken still rejects non-generated strings', () => {
      fc.assert(
        fc.property(
          usernameArb,
          accountTypeArb,
          invalidTokenArb,
          (username, accountType, randomToken) => {
            // Generate a real token to populate the store
            const realToken = generateResetToken(username, accountType);

            // Precondition: the random token should not coincidentally equal the real token
            fc.pre(randomToken !== realToken);

            // The random token should still be rejected
            const result = validateResetToken(randomToken);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // Feature: backend-stub-implementations, Property 11: Reset token single-use enforcement
  describe('Property 11: Reset token single-use enforcement', () => {
    it('for any generated token, after consumeResetToken succeeds, subsequent consume calls return false and validate returns null', () => {
      fc.assert(
        fc.property(usernameArb, accountTypeArb, (username, accountType) => {
          const token = generateResetToken(username, accountType);

          // First consumption should succeed
          const firstConsume = consumeResetToken(token);
          expect(firstConsume).toBe(true);

          // Second consumption should fail
          const secondConsume = consumeResetToken(token);
          expect(secondConsume).toBe(false);

          // validateResetToken should now return null
          const entry = validateResetToken(token);
          expect(entry).toBeNull();
        }),
        { numRuns: 200 },
      );
    });
  });
});
