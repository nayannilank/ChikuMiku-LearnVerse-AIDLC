/**
 * Property Test: Exercise Completion Score Calculation
 *
 * Property 16: For any set of exercise results containing C correct answers
 * out of T total exercises, the displayed score SHALL equal C and total SHALL equal T.
 *
 * **Validates: Requirements 11.10, 13.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateScore } from '../ExerciseAssistant';
import type { EvaluateResponse, HintResponse } from '../ExerciseAssistant';

// ============================================================
// Types (mirror ExerciseState from ExerciseAssistant)
// ============================================================

interface ExerciseState {
  answer: string;
  selectedOption: number | null;
  hint: HintResponse | null;
  hintLoading: boolean;
  evaluation: EvaluateResponse | null;
  evaluationLoading: boolean;
  attemptCount: number;
  submitted: boolean;
}

// ============================================================
// Arbitraries (Generators)
// ============================================================

/** Represents the status of an exercise in the sequence */
type ExerciseStatus = 'correct' | 'incorrect' | 'not-submitted';

/** Generates a random exercise status */
const exerciseStatusArb: fc.Arbitrary<ExerciseStatus> = fc.constantFrom(
  'correct',
  'incorrect',
  'not-submitted',
);

/** Generates a valid EvaluateResponse */
const evaluateResponseArb = (isCorrect: boolean): EvaluateResponse => ({
  isCorrect,
  score: isCorrect ? 1 : 0,
  feedback: isCorrect ? 'Correct!' : 'Incorrect.',
  referencedSection: isCorrect ? undefined : 'Chapter 1, Section 2',
});

/** Generates an ExerciseState from a status */
function makeExerciseState(status: ExerciseStatus): ExerciseState {
  switch (status) {
    case 'correct':
      return {
        answer: 'some answer',
        selectedOption: 1,
        hint: null,
        hintLoading: false,
        evaluation: evaluateResponseArb(true),
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      };
    case 'incorrect':
      return {
        answer: 'wrong answer',
        selectedOption: 2,
        hint: null,
        hintLoading: false,
        evaluation: evaluateResponseArb(false),
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      };
    case 'not-submitted':
      return {
        answer: '',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        evaluationLoading: false,
        attemptCount: 0,
        submitted: false,
      };
  }
}

/** Generates a random array of exercise statuses (1 to 30 exercises) */
const exerciseSequenceArb: fc.Arbitrary<ExerciseStatus[]> = fc.array(
  exerciseStatusArb,
  { minLength: 1, maxLength: 30 },
);

/** Builds an ExerciseState Map from an array of statuses */
function buildExerciseStateMap(statuses: ExerciseStatus[]): Map<string, ExerciseState> {
  const map = new Map<string, ExerciseState>();
  statuses.forEach((status, index) => {
    map.set(`exercise-${index}`, makeExerciseState(status));
  });
  return map;
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 16: Exercise Completion Score Calculation', () => {
  it('score.correct equals the number of submitted exercises with isCorrect=true', () => {
    fc.assert(
      fc.property(exerciseSequenceArb, (statuses) => {
        const map = buildExerciseStateMap(statuses);
        const score = calculateScore(map);

        const expectedCorrect = statuses.filter((s) => s === 'correct').length;
        expect(score.correct).toBe(expectedCorrect);
      }),
      { numRuns: 200 },
    );
  });

  it('score.total equals the number of submitted exercises that have an evaluation', () => {
    fc.assert(
      fc.property(exerciseSequenceArb, (statuses) => {
        const map = buildExerciseStateMap(statuses);
        const score = calculateScore(map);

        const expectedTotal = statuses.filter(
          (s) => s === 'correct' || s === 'incorrect',
        ).length;
        expect(score.total).toBe(expectedTotal);
      }),
      { numRuns: 200 },
    );
  });

  it('correct is always less than or equal to total (invariant)', () => {
    fc.assert(
      fc.property(exerciseSequenceArb, (statuses) => {
        const map = buildExerciseStateMap(statuses);
        const score = calculateScore(map);

        expect(score.correct).toBeLessThanOrEqual(score.total);
      }),
      { numRuns: 200 },
    );
  });

  it('total is always less than or equal to map size (cannot have more evaluated than total exercises)', () => {
    fc.assert(
      fc.property(exerciseSequenceArb, (statuses) => {
        const map = buildExerciseStateMap(statuses);
        const score = calculateScore(map);

        expect(score.total).toBeLessThanOrEqual(map.size);
      }),
      { numRuns: 200 },
    );
  });

  it('empty map returns { correct: 0, total: 0 }', () => {
    const emptyMap = new Map<string, ExerciseState>();
    const score = calculateScore(emptyMap);
    expect(score.correct).toBe(0);
    expect(score.total).toBe(0);
  });

  it('submitted exercises without evaluation are not counted in total', () => {
    // Generate states where submitted=true but evaluation=null (edge case)
    const submittedNoEvalArb = fc.array(
      fc.constantFrom('submitted-no-eval' as const, 'correct' as const, 'incorrect' as const, 'not-submitted' as const),
      { minLength: 1, maxLength: 20 },
    );

    fc.assert(
      fc.property(submittedNoEvalArb, (statuses) => {
        const map = new Map<string, ExerciseState>();
        let expectedTotal = 0;
        let expectedCorrect = 0;

        statuses.forEach((status, index) => {
          if (status === 'submitted-no-eval') {
            // submitted=true but evaluation=null (e.g., evaluation still loading)
            map.set(`exercise-${index}`, {
              answer: 'pending',
              selectedOption: 0,
              hint: null,
              hintLoading: false,
              evaluation: null,
              evaluationLoading: true,
              attemptCount: 1,
              submitted: true,
            });
          } else {
            map.set(`exercise-${index}`, makeExerciseState(status));
            if (status === 'correct') {
              expectedTotal++;
              expectedCorrect++;
            } else if (status === 'incorrect') {
              expectedTotal++;
            }
          }
        });

        const score = calculateScore(map);
        expect(score.correct).toBe(expectedCorrect);
        expect(score.total).toBe(expectedTotal);
      }),
      { numRuns: 200 },
    );
  });
});
