/**
 * Unit tests for GrammarExerciseScreen helper functions and core logic.
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 */

import { describe, it, expect } from 'vitest';
import { calculateProgressPercentage, renderSentenceWithBlank } from './GrammarExerciseScreen';

describe('GrammarExerciseScreen', () => {
  describe('calculateProgressPercentage', () => {
    it('returns 0 when no questions are answered', () => {
      expect(calculateProgressPercentage(0, 10)).toBe(0);
    });

    it('returns 100 when all questions are answered', () => {
      expect(calculateProgressPercentage(10, 10)).toBe(100);
    });

    it('returns correct percentage for partial progress', () => {
      expect(calculateProgressPercentage(3, 10)).toBe(30);
      expect(calculateProgressPercentage(1, 3)).toBe(33);
      expect(calculateProgressPercentage(7, 8)).toBe(88);
    });

    it('returns 0 when total is 0', () => {
      expect(calculateProgressPercentage(0, 0)).toBe(0);
    });

    it('returns 50 for half answered', () => {
      expect(calculateProgressPercentage(5, 10)).toBe(50);
    });
  });

  describe('renderSentenceWithBlank', () => {
    it('splits sentence at underscore placeholder', () => {
      const result = renderSentenceWithBlank('The cat ___ on the mat.');
      // Should return 3 parts: "The cat ", blank, " on the mat."
      expect(result.length).toBe(3);
    });

    it('handles sentence with no blank', () => {
      const result = renderSentenceWithBlank('No blank here.');
      expect(result.length).toBe(1);
    });

    it('handles sentence with multiple underscores', () => {
      const result = renderSentenceWithBlank('She ____ going to the ____.');
      // Two blanks should produce 4 parts (or more depending on splitting)
      expect(result.length).toBeGreaterThan(2);
    });

    it('handles longer underscore sequences', () => {
      const result = renderSentenceWithBlank('Fill in: ________');
      // "Fill in: " + blank + "" (trailing empty from split)
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });
});
