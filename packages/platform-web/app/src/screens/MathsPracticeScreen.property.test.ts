/**
 * Property Test: Maths Input Validation
 *
 * Property 29: For any string input to validateMathsInput:
 * - Integers 0–99 are accepted (valid: true)
 * - Empty/whitespace-only strings are rejected with an error message
 * - Non-numeric characters (letters, symbols, decimals) are rejected with an error message
 * - Integers outside [0, 99] are rejected with an error message
 *
 * **Validates: Requirements 15.2, 15.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateMathsInput } from './MathsPracticeScreen';

describe('Property 29: Maths Input Validation', () => {
  describe('valid integers in [0, 99]', () => {
    it('for any integer in [0, 99], its string representation is accepted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          (n) => {
            const result = validateMathsInput(String(n));
            expect(result).toEqual({ valid: true });
          }
        ),
        { numRuns: 500 }
      );
    });

    it('accepts integers with leading/trailing whitespace', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 5 }),
          fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 5 }),
          (n, prefix, suffix) => {
            const result = validateMathsInput(`${prefix}${n}${suffix}`);
            expect(result).toEqual({ valid: true });
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe('empty or whitespace-only strings', () => {
    it('empty string returns invalid with error', () => {
      const result = validateMathsInput('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('for any whitespace-only string, validation returns invalid with error', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }),
          (whitespace) => {
            const result = validateMathsInput(whitespace);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe('non-integer strings', () => {
    it('for any string containing non-numeric characters (letters, symbols), returns invalid', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => {
            const trimmed = s.trim();
            // Must have content and must contain at least one non-digit, non-minus character
            // OR be something that isn't a pure integer pattern
            return trimmed.length > 0 && !/^-?\d+$/.test(trimmed);
          }),
          (s) => {
            const result = validateMathsInput(s);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 500 }
      );
    });

    it('decimal numbers (e.g., "3.5") are rejected as invalid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 1, max: 99 }),
          (intPart, fracPart) => {
            const decimalStr = `${intPart}.${fracPart}`;
            const result = validateMathsInput(decimalStr);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 300 }
      );
    });

    it('strings with letters mixed with digits are rejected as invalid', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('a', 'b', 'c', 'x', 'Z', '1', '2', '3'), {
            minLength: 1,
            maxLength: 10,
          }).filter((s) => /[a-zA-Z]/.test(s) && s.trim().length > 0),
          (s) => {
            const result = validateMathsInput(s);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe('out-of-range integers', () => {
    it('for any integer < 0, its string representation returns invalid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (n) => {
            const result = validateMathsInput(String(n));
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 300 }
      );
    });

    it('for any integer > 99, its string representation returns invalid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          (n) => {
            const result = validateMathsInput(String(n));
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 300 }
      );
    });
  });
});
