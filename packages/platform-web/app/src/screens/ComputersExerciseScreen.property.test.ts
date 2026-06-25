/**
 * Property Test: Computers Exercise Match Validation
 *
 * Property 30: For any matching exercise with P pairs (3 ≤ P ≤ 8),
 * submitting before completing all matches SHALL report the remaining count
 * (P - matched); after all matches are submitted, each pair SHALL be marked
 * correct (green) or incorrect (red) based on comparison with the correct solution.
 *
 * **Validates: Requirements 16.2, 16.3, 16.4, 16.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateMatches, MatchEntry } from './ComputersExerciseScreen';

// ============================================================
// Custom Arbitraries
// ============================================================

/**
 * Generates a match entry with a given pair index and random selected/correct answers.
 */
const matchEntryArb = (pairIndex: number): fc.Arbitrary<MatchEntry> =>
  fc.record({
    pairIndex: fc.constant(pairIndex),
    selectedAnswer: fc.string({ minLength: 1, maxLength: 50 }),
    correctAnswer: fc.string({ minLength: 1, maxLength: 50 }),
  });

/**
 * Generates a correct match entry (selectedAnswer === correctAnswer).
 */
const correctMatchEntryArb = (pairIndex: number): fc.Arbitrary<MatchEntry> =>
  fc.string({ minLength: 1, maxLength: 50 }).map((answer) => ({
    pairIndex,
    selectedAnswer: answer,
    correctAnswer: answer,
  }));

/**
 * Generates an incorrect match entry (selectedAnswer !== correctAnswer).
 */
const incorrectMatchEntryArb = (pairIndex: number): fc.Arbitrary<MatchEntry> =>
  fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.string({ minLength: 1, maxLength: 50 })
    )
    .filter(([a, b]) => a !== b)
    .map(([selected, correct]) => ({
      pairIndex,
      selectedAnswer: selected,
      correctAnswer: correct,
    }));

// ============================================================
// Property Tests
// ============================================================

describe('Property 30: Computers Exercise Match Validation', () => {
  it('for any total pairs N in [3, 8] and matches array of length < N, result.complete === false and result.remainingCount === N - matches.length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }).chain((totalPairs) =>
          fc
            .integer({ min: 0, max: totalPairs - 1 })
            .chain((matchCount) =>
              fc.tuple(
                fc.constant(totalPairs),
                fc.array(
                  matchEntryArb(0),
                  { minLength: matchCount, maxLength: matchCount }
                ).map((entries: MatchEntry[]) =>
                  entries.map((entry, idx) => ({ ...entry, pairIndex: idx }))
                )
              )
            )
        ),
        ([totalPairs, matches]) => {
          const result = validateMatches(totalPairs, matches);
          expect(result.complete).toBe(false);
          if (!result.complete) {
            expect(result.remainingCount).toBe(totalPairs - matches.length);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('for any total pairs N in [3, 8] and matches array of length === N, result.complete === true and results has exactly N entries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }).chain((totalPairs) =>
          fc.tuple(
            fc.constant(totalPairs),
            fc.array(matchEntryArb(0), {
              minLength: totalPairs,
              maxLength: totalPairs,
            }).map((entries) =>
              entries.map((entry, idx) => ({ ...entry, pairIndex: idx }))
            )
          )
        ),
        ([totalPairs, matches]) => {
          const result = validateMatches(totalPairs, matches);
          expect(result.complete).toBe(true);
          if (result.complete) {
            expect(result.results).toHaveLength(totalPairs);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('each result entry has a boolean isCorrect field', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }).chain((totalPairs) =>
          fc.tuple(
            fc.constant(totalPairs),
            fc.array(matchEntryArb(0), {
              minLength: totalPairs,
              maxLength: totalPairs,
            }).map((entries) =>
              entries.map((entry, idx) => ({ ...entry, pairIndex: idx }))
            )
          )
        ),
        ([totalPairs, matches]) => {
          const result = validateMatches(totalPairs, matches);
          if (result.complete) {
            for (const entry of result.results) {
              expect(typeof entry.isCorrect).toBe('boolean');
              expect(typeof entry.pairIndex).toBe('number');
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('after reset (empty matches), remaining count equals total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        (totalPairs) => {
          const result = validateMatches(totalPairs, []);
          expect(result.complete).toBe(false);
          if (!result.complete) {
            expect(result.remainingCount).toBe(totalPairs);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('correct matches are identified as isCorrect: true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }).chain((totalPairs) => {
          const entries = Array.from({ length: totalPairs }, (_, i) =>
            correctMatchEntryArb(i)
          );
          return fc.tuple(fc.constant(totalPairs), fc.tuple(...entries));
        }),
        ([totalPairs, matches]) => {
          const result = validateMatches(totalPairs, matches);
          expect(result.complete).toBe(true);
          if (result.complete) {
            for (const entry of result.results) {
              expect(entry.isCorrect).toBe(true);
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('incorrect matches are identified as isCorrect: false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }).chain((totalPairs) => {
          const entries = Array.from({ length: totalPairs }, (_, i) =>
            incorrectMatchEntryArb(i)
          );
          return fc.tuple(fc.constant(totalPairs), fc.tuple(...entries));
        }),
        ([totalPairs, matches]) => {
          const result = validateMatches(totalPairs, matches);
          expect(result.complete).toBe(true);
          if (result.complete) {
            for (const entry of result.results) {
              expect(entry.isCorrect).toBe(false);
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
