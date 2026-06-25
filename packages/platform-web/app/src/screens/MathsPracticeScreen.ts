/**
 * MathsPracticeScreen — Maths Practice with Visual Aids
 *
 * Provides interactive fraction practice with numerator/denominator input validation.
 * Requirements: 15.1–15.7
 */

export interface MathsValidationSuccess {
  valid: true;
  value: number;
}

export interface MathsValidationFailure {
  valid: false;
  reason: 'empty' | 'non_integer' | 'out_of_range';
}

export type MathsValidationResult = MathsValidationSuccess | MathsValidationFailure;

/**
 * Validates a maths input string for the numerator/denominator fields.
 *
 * Acceptance rules (Req 15.2, 15.4):
 * - Accepts strings representing integers 0–99
 * - Rejects empty or whitespace-only strings (reason: 'empty')
 * - Rejects non-integer strings such as letters, symbols, or decimals (reason: 'non_integer')
 * - Rejects integers outside the 0–99 range (reason: 'out_of_range')
 */
export function validateMathsInput(value: string): MathsValidationResult {
  // Reject empty or whitespace-only strings
  if (value.trim().length === 0) {
    return { valid: false, reason: 'empty' };
  }

  const trimmed = value.trim();

  // Check if the string represents a valid integer (only digits, optionally preceded by a minus sign)
  // We explicitly check for decimal points, letters, and other non-numeric characters
  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, reason: 'non_integer' };
  }

  const parsed = parseInt(trimmed, 10);

  // Check range: must be 0–99 inclusive
  if (parsed < 0 || parsed > 99) {
    return { valid: false, reason: 'out_of_range' };
  }

  return { valid: true, value: parsed };
}
