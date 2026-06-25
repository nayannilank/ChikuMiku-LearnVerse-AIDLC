/**
 * Property Test: Pronunciation Scoring
 *
 * Property 17: Pronunciation Scoring
 * - For any random syllable arrays and transcriptions, accuracyScore is always 0-100 inclusive
 * - syllableResults array has exactly N entries (where N = syllables.length, or 1 if empty)
 * - Each syllable result's syllable field matches the input syllable at the same index
 * - If syllables array is empty, syllableResults has exactly 1 entry (whole-word comparison)
 *
 * **Validates: Requirements 12.5, 12.6**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeSyllableAccuracy } from './uploadRecording';

// ============================================================
// Arbitraries
// ============================================================

/**
 * Generates a random non-empty syllable string (1-10 lowercase alpha characters).
 */
const syllableArb = fc.stringOf(fc.char().filter((c) => c >= 'a' && c <= 'z'), {
  minLength: 1,
  maxLength: 10,
});

/**
 * Generates a random syllable array of length 1-20.
 */
const syllablesArb = fc.array(syllableArb, { minLength: 1, maxLength: 20 });

/**
 * Generates a random transcription string (can include spaces, punctuation, mixed case).
 */
const transcriptionArb = fc.string({ minLength: 0, maxLength: 100 });

/**
 * Generates a random expected word (non-empty string of alpha characters).
 */
const expectedWordArb = fc.stringOf(fc.char().filter((c) => c >= 'a' && c <= 'z'), {
  minLength: 1,
  maxLength: 30,
});

// ============================================================
// Property Tests
// ============================================================

describe('Property 17: Pronunciation Scoring', () => {
  describe('accuracyScore range', () => {
    it('accuracyScore is always an integer in [0, 100] for any syllables and transcription', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, syllablesArb, (transcription, expectedWord, syllables) => {
          const { accuracyScore } = computeSyllableAccuracy(transcription, expectedWord, syllables);
          expect(accuracyScore).toBeGreaterThanOrEqual(0);
          expect(accuracyScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(accuracyScore)).toBe(true);
        }),
        { numRuns: 500 },
      );
    });

    it('accuracyScore is always an integer in [0, 100] for empty syllables (whole-word comparison)', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, (transcription, expectedWord) => {
          const { accuracyScore } = computeSyllableAccuracy(transcription, expectedWord, []);
          expect(accuracyScore).toBeGreaterThanOrEqual(0);
          expect(accuracyScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(accuracyScore)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('syllableResults length', () => {
    it('syllableResults has exactly N entries for a syllable array of length N', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, syllablesArb, (transcription, expectedWord, syllables) => {
          const { syllableResults } = computeSyllableAccuracy(transcription, expectedWord, syllables);
          expect(syllableResults).toHaveLength(syllables.length);
        }),
        { numRuns: 500 },
      );
    });

    it('syllableResults has exactly 1 entry when syllables array is empty', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, (transcription, expectedWord) => {
          const { syllableResults } = computeSyllableAccuracy(transcription, expectedWord, []);
          expect(syllableResults).toHaveLength(1);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('syllable field correctness', () => {
    it('each syllable result syllable field matches the input syllable at the same index', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, syllablesArb, (transcription, expectedWord, syllables) => {
          const { syllableResults } = computeSyllableAccuracy(transcription, expectedWord, syllables);
          for (let i = 0; i < syllables.length; i++) {
            expect(syllableResults[i].syllable).toBe(syllables[i]);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('when syllables is empty, the single result syllable field equals the expected word', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, (transcription, expectedWord) => {
          const { syllableResults } = computeSyllableAccuracy(transcription, expectedWord, []);
          expect(syllableResults[0].syllable).toBe(expectedWord);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('isCorrect field type', () => {
    it('each syllable result isCorrect field is a boolean', () => {
      fc.assert(
        fc.property(transcriptionArb, expectedWordArb, syllablesArb, (transcription, expectedWord, syllables) => {
          const { syllableResults } = computeSyllableAccuracy(transcription, expectedWord, syllables);
          for (const result of syllableResults) {
            expect(typeof result.isCorrect).toBe('boolean');
          }
        }),
        { numRuns: 300 },
      );
    });
  });
});
