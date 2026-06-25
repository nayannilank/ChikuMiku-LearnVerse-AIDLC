/**
 * Property Test: EVS Ordering Validation
 *
 * Property 31: For any random stage sequence (3-8 stages),
 * shuffleStages produces a same-length, same-element array in a different order;
 * validateOrderLocal returns per-item correctness matching positional equality
 * and allCorrect is true only when every item is in the correct position.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5, 17.6**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shuffleStages, validateOrderLocal } from './EVSVisualizationScreen';

// ============================================================
// Custom Arbitraries
// ============================================================

/**
 * Generates a unique string array representing stage IDs (length 2-8).
 * Uses unique elements to ensure shuffle detection is deterministic.
 */
const stageArrayArb = (minLen = 2, maxLen = 8) =>
  fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), {
    minLength: minLen,
    maxLength: maxLen,
  });

/**
 * Generates a pair of string arrays (studentOrder, correctOrder) of the same length.
 */
const orderPairArb = fc
  .integer({ min: 1, max: 8 })
  .chain((len) =>
    fc.tuple(
      fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
        minLength: len,
        maxLength: len,
      }),
      fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
        minLength: len,
        maxLength: len,
      })
    )
  );

// ============================================================
// Property Tests
// ============================================================

describe('Property 31: EVS Ordering Validation', () => {
  it('shuffleStages preserves array length and elements for arrays of length 2-8', () => {
    fc.assert(
      fc.property(stageArrayArb(2, 8), (stages) => {
        const shuffled = shuffleStages(stages);

        // Same length
        expect(shuffled).toHaveLength(stages.length);

        // Same elements (as a multiset)
        const sortedOriginal = [...stages].sort();
        const sortedShuffled = [...shuffled].sort();
        expect(sortedShuffled).toEqual(sortedOriginal);
      }),
      { numRuns: 500 }
    );
  });

  it('shuffleStages produces a different order from original for arrays of length > 1 (statistical)', () => {
    // The implementation uses Fisher-Yates with retry logic (up to 10 attempts).
    // For a 2-element array there is a (1/2)^10 ≈ 0.1% chance all retries fail.
    // We verify statistically: across multiple shuffles at least one should differ.
    fc.assert(
      fc.property(stageArrayArb(2, 8), (stages) => {
        // Run 5 independent shuffles; at least one must differ from original
        let anyDiffered = false;
        for (let trial = 0; trial < 5; trial++) {
          const shuffled = shuffleStages(stages);
          const isSameOrder = shuffled.every((item, idx) => item === stages[idx]);
          if (!isSameOrder) {
            anyDiffered = true;
            break;
          }
        }
        expect(anyDiffered).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('validateOrderLocal returns perItemCorrectness with length equal to input length', () => {
    fc.assert(
      fc.property(orderPairArb, ([studentOrder, correctOrder]) => {
        const result = validateOrderLocal(studentOrder, correctOrder);
        expect(result.perItemCorrectness).toHaveLength(studentOrder.length);
      }),
      { numRuns: 200 }
    );
  });

  it('each perItemCorrectness entry is true iff student item matches correct item at that index', () => {
    fc.assert(
      fc.property(orderPairArb, ([studentOrder, correctOrder]) => {
        const result = validateOrderLocal(studentOrder, correctOrder);

        for (let i = 0; i < studentOrder.length; i++) {
          if (studentOrder[i] === correctOrder[i]) {
            expect(result.perItemCorrectness[i]).toBe(true);
          } else {
            expect(result.perItemCorrectness[i]).toBe(false);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('allCorrect is true only when all items are in correct positions', () => {
    fc.assert(
      fc.property(orderPairArb, ([studentOrder, correctOrder]) => {
        const result = validateOrderLocal(studentOrder, correctOrder);

        const expectedAllCorrect = studentOrder.every(
          (item, idx) => item === correctOrder[idx]
        );
        expect(result.allCorrect).toBe(expectedAllCorrect);
      }),
      { numRuns: 200 }
    );
  });
});
