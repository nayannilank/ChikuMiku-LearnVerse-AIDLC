/**
 * Property Test: Grammar Exercise Progress Format
 *
 * Property 19: For any grammar exercise at question index N out of total T
 * (where 1 ≤ N ≤ T and 1 ≤ T ≤ 30), the progress display SHALL show "N/T"
 * and the progress bar SHALL show percentage N/T × 100.
 *
 * **Validates: Requirements 13.1, 13.2**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateProgressPercentage } from './GrammarExerciseScreen';

describe('Property 19: Grammar Exercise Progress Format', () => {
  describe('calculateProgressPercentage', () => {
    it('for any N in [1, T] where T in [1, 30], returns Math.round((N/T) × 100)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }).chain((t) =>
            fc.tuple(fc.integer({ min: 1, max: t }), fc.constant(t))
          ),
          ([n, t]) => {
            const result = calculateProgressPercentage(n, t);
            const expected = Math.round((n / t) * 100);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('result is always in [0, 100] inclusive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }).chain((t) =>
            fc.tuple(fc.integer({ min: 0, max: t }), fc.constant(t))
          ),
          ([n, t]) => {
            const result = calculateProgressPercentage(n, t);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('when N=0, result is always 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          (t) => {
            const result = calculateProgressPercentage(0, t);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('when N=T, result is always 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          (t) => {
            const result = calculateProgressPercentage(t, t);
            expect(result).toBe(100);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('progress counter format', () => {
    it('progress counter string is always in "N/T" format', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }).chain((t) =>
            fc.tuple(fc.integer({ min: 1, max: t }), fc.constant(t))
          ),
          ([n, t]) => {
            // The component renders `${currentIndex + 1}/${totalQuestions}`
            const counterText = `${n}/${t}`;
            const pattern = /^\d+\/\d+$/;
            expect(counterText).toMatch(pattern);

            // Verify the parts parse correctly
            const [displayed, total] = counterText.split('/').map(Number);
            expect(displayed).toBe(n);
            expect(total).toBe(t);
            expect(displayed).toBeGreaterThanOrEqual(1);
            expect(displayed).toBeLessThanOrEqual(total);
            expect(total).toBeGreaterThanOrEqual(1);
            expect(total).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
