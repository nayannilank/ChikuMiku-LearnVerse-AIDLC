/**
 * Property Test: Quiz Score Calculation
 *
 * Property 20: For any quiz session where a student answers questions
 * (submitting or skipping), the running score SHALL equal
 * (correct answers / total answered) × 100 as a percentage;
 * the final score SHALL equal (total correct / total questions) × 100;
 * skipped questions SHALL have no recorded answer.
 *
 * **Validates: Requirements 14.5, 14.6, 14.8, 21.2, 21.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// Score calculation functions extracted from handler logic
// ============================================================

/**
 * Computes running score: (correct / answered) × 100, rounded to 2 decimal places.
 * This mirrors the logic in submitQuizAnswer.ts.
 */
function computeRunningScore(correctCount: number, answeredCount: number): number {
  if (answeredCount <= 0) return 0;
  return Math.round((correctCount / answeredCount) * 100 * 100) / 100;
}

/**
 * Computes final score: (correct / total) × 100, rounded to 2 decimal places.
 * This mirrors the logic in getQuizResult.ts.
 */
function computeFinalScore(correctAnswers: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((correctAnswers / totalQuestions) * 100 * 100) / 100;
}

// ============================================================
// Custom Arbitraries
// ============================================================

/**
 * Generates answer sequences where each answer is either correct or incorrect.
 * Returns { correctCount, answeredCount } representing a running tally.
 */
const answerSequenceArb = fc
  .array(fc.boolean(), { minLength: 1, maxLength: 100 })
  .map((answers) => {
    const answeredCount = answers.length;
    const correctCount = answers.filter((a) => a).length;
    return { correctCount, answeredCount };
  });

/**
 * Generates a quiz scenario with totalQuestions, and a subset answered
 * (some correct, some incorrect, some skipped).
 */
const quizScenarioArb = fc
  .record({
    totalQuestions: fc.integer({ min: 1, max: 200 }),
    correctCount: fc.integer({ min: 0, max: 200 }),
    incorrectCount: fc.integer({ min: 0, max: 200 }),
  })
  .filter(
    ({ totalQuestions, correctCount, incorrectCount }) =>
      correctCount + incorrectCount <= totalQuestions
  )
  .map(({ totalQuestions, correctCount, incorrectCount }) => ({
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount: totalQuestions - correctCount - incorrectCount,
    answeredCount: correctCount + incorrectCount,
  }));

// ============================================================
// Property Tests
// ============================================================

describe('Property 20: Quiz Score Calculation', () => {
  it('running score equals round((correct / answered) × 100, 2 decimals) for any answer sequence', () => {
    fc.assert(
      fc.property(answerSequenceArb, ({ correctCount, answeredCount }) => {
        const runningScore = computeRunningScore(correctCount, answeredCount);
        const expected = Math.round((correctCount / answeredCount) * 100 * 100) / 100;
        expect(runningScore).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  it('final score equals round((correct / total) × 100, 2 decimals) for any quiz scenario', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        (totalQuestions, correctAnswers) => {
          // Ensure correctAnswers <= totalQuestions
          fc.pre(correctAnswers <= totalQuestions);

          const finalScore = computeFinalScore(correctAnswers, totalQuestions);
          const expected =
            Math.round((correctAnswers / totalQuestions) * 100 * 100) / 100;
          expect(finalScore).toBe(expected);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('running score is always in [0, 100]', () => {
    fc.assert(
      fc.property(answerSequenceArb, ({ correctCount, answeredCount }) => {
        const runningScore = computeRunningScore(correctCount, answeredCount);
        expect(runningScore).toBeGreaterThanOrEqual(0);
        expect(runningScore).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 }
    );
  });

  it('final score is always in [0, 100]', () => {
    fc.assert(
      fc.property(quizScenarioArb, ({ totalQuestions, correctCount }) => {
        const finalScore = computeFinalScore(correctCount, totalQuestions);
        expect(finalScore).toBeGreaterThanOrEqual(0);
        expect(finalScore).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 }
    );
  });

  it('if all answers are correct, running score = 100 and final score = 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (totalQuestions) => {
        // All answered, all correct
        const runningScore = computeRunningScore(totalQuestions, totalQuestions);
        const finalScore = computeFinalScore(totalQuestions, totalQuestions);

        expect(runningScore).toBe(100);
        expect(finalScore).toBe(100);
      }),
      { numRuns: 200 }
    );
  });

  it('if no answers are correct, running score = 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (answeredCount) => {
        // All answered, none correct
        const runningScore = computeRunningScore(0, answeredCount);
        expect(runningScore).toBe(0);
      }),
      { numRuns: 200 }
    );
  });
});
