/**
 * Unit tests for QuizScreen helper functions and core logic.
 *
 * Validates: Requirements 14.1, 14.5, 14.7
 */

import { describe, it, expect } from 'vitest';
import { formatTimer, calculateScorePercentage } from './QuizScreen';

describe('QuizScreen', () => {
  describe('formatTimer', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatTimer(0)).toBe('00:00');
    });

    it('formats 30 seconds as 00:30', () => {
      expect(formatTimer(30)).toBe('00:30');
    });

    it('formats 60 seconds as 01:00', () => {
      expect(formatTimer(60)).toBe('01:00');
    });

    it('formats 90 seconds as 01:30', () => {
      expect(formatTimer(90)).toBe('01:30');
    });

    it('formats 3600 seconds (60 min) as 60:00', () => {
      expect(formatTimer(3600)).toBe('60:00');
    });

    it('formats 125 seconds as 02:05', () => {
      expect(formatTimer(125)).toBe('02:05');
    });

    it('handles negative values by clamping to 0', () => {
      expect(formatTimer(-5)).toBe('00:00');
    });

    it('handles fractional values by flooring', () => {
      expect(formatTimer(61.9)).toBe('01:01');
    });
  });

  describe('calculateScorePercentage', () => {
    it('returns 0 when total is 0', () => {
      expect(calculateScorePercentage(0, 0)).toBe(0);
    });

    it('returns 100 for perfect score', () => {
      expect(calculateScorePercentage(20, 20)).toBe(100);
    });

    it('returns 0 for no correct answers', () => {
      expect(calculateScorePercentage(0, 10)).toBe(0);
    });

    it('calculates correct percentage', () => {
      expect(calculateScorePercentage(7, 10)).toBe(70);
      expect(calculateScorePercentage(1, 3)).toBe(33);
      expect(calculateScorePercentage(3, 4)).toBe(75);
    });

    it('rounds to nearest integer', () => {
      expect(calculateScorePercentage(1, 6)).toBe(17);
      expect(calculateScorePercentage(2, 3)).toBe(67);
    });
  });
});
