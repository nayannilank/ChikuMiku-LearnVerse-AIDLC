/**
 * Property Test: Content Name Validation
 *
 * Property 10: For any book or chapter name, the system SHALL accept names
 * between 1 and 200 characters (trimmed) and SHALL reject names that are
 * empty or exceed 200 characters (trimmed).
 *
 * **Validates: Requirements 7.3, 7.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateContentName } from './ContentIngestionScreen';

describe('Property 10: Content Name Validation', () => {
  it('accepts names with trimmed length between 1 and 200 characters (returns null)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 200),
        (name) => {
          const result = validateContentName(name);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('rejects empty strings (returns non-null error)', () => {
    const result = validateContentName('');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('rejects whitespace-only strings (trimmed length 0) with a non-null error', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
        (name) => {
          const result = validateContentName(name);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects names with trimmed length exceeding 200 characters (returns non-null error)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 500 }).filter((s) => s.trim().length > 200),
        (name) => {
          const result = validateContentName(name);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        }
      ),
      { numRuns: 500 }
    );
  });

  it('generates random strings (0-500 chars) and validates boundary behavior correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (name) => {
          const trimmedLength = name.trim().length;
          const result = validateContentName(name);

          if (trimmedLength >= 1 && trimmedLength <= 200) {
            // Valid range: should accept (return null)
            expect(result).toBeNull();
          } else {
            // Invalid: empty or >200 chars should reject (return non-null error string)
            expect(result).not.toBeNull();
            expect(typeof result).toBe('string');
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
