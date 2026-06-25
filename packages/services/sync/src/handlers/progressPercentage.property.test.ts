/**
 * Property Test: Progress Percentage Calculation
 *
 * Property 24: For any completed/total exercise pair, the progress percentage
 * SHALL equal floor(completed / total × 100) clamped to [0, 100].
 *
 * **Validates: Requirements 19.2**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// Progress percentage calculation extracted from handler logic
// ============================================================

/**
 * Calculates progress percentage: floor(completed / total × 100) clamped to [0, 100].
 * This mirrors the logic in recordExerciseResult.ts.
 */
function calculateProgressPercentage(completed: number, total: number): number {
  return Math.max(0, Math.min(100, Math.floor((completed / total) * 100)));
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 24: Progress Percentage Calculation', () => {
  it('percentage is always an integer (no decimals)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (completed, total) => {
          const percentage = calculateProgressPercentage(completed, total);
          expect(Number.isInteger(percentage)).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('percentage is always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (completed, total) => {
          const percentage = calculateProgressPercentage(completed, total);
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('when completed < total: percentage equals floor(completed / total × 100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 1, max: 10000 }),
        (completed, total) => {
          fc.pre(completed < total);

          const percentage = calculateProgressPercentage(completed, total);
          const expected = Math.floor((completed / total) * 100);
          expect(percentage).toBe(expected);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('when completed >= total: percentage is clamped to 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (completed, total) => {
          fc.pre(completed >= total);

          const percentage = calculateProgressPercentage(completed, total);
          expect(percentage).toBe(100);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('when completed = 0: percentage is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (total) => {
          const percentage = calculateProgressPercentage(0, total);
          expect(percentage).toBe(0);
        }
      ),
      { numRuns: 500 }
    );
  });
});
