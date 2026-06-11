/**
 * Property Tests: ValidationEngine
 *
 * Feature: registration-and-password-reset
 *
 * **Validates: Requirements 4.1–4.8, 8.1–8.6, 11.2–11.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  lengthValidator,
  charsetValidator,
  emailValidator,
  phoneValidator,
  matchValidator,
  validate,
  type ExtendedFieldRule,
} from './ValidationEngine';

// --- Arbitraries ---

/** Generates valid bounds [min, max] where 0 <= min <= max <= 100 */
const boundsArb = fc
  .tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }))
  .map(([a, b]) => (a <= b ? { min: a, max: b } : { min: b, max: a }));

/** Generates arbitrary strings up to 150 chars for length testing */
const stringArb = fc.string({ minLength: 0, maxLength: 150 });

/** Generates strings composed only of characters from a known charset */
const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const alphanumCharArb = fc.constantFrom(...alphanumChars.split(''));
const alphanumStringArb = fc.array(alphanumCharArb, { minLength: 0, maxLength: 50 }).map((arr) => arr.join(''));

/** Generates strings that contain at least one character NOT in the alphanumeric charset */
const nonAlphanumCharArb = fc.char().filter((c) => !/[a-zA-Z0-9]/.test(c));
const stringWithInvalidCharArb = fc
  .tuple(alphanumStringArb, nonAlphanumCharArb, alphanumStringArb)
  .map(([prefix, bad, suffix]) => prefix + bad + suffix);

/** Generates exactly 10-digit strings */
const tenDigitStringArb = fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: 10, maxLength: 10 }).map((arr) => arr.join(''));

/** Generates digit-only strings of length != 10 */
const nonTenDigitStringArb = fc
  .tuple(
    fc.integer({ min: 0, max: 30 }).filter((n) => n !== 10),
    fc.constantFrom(...'0123456789'.split(''))
  )
  .chain(([len, _]) =>
    fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: len, maxLength: len }).map((arr) => arr.join(''))
  );

/** Generates strings with non-digit characters */
const stringWithNonDigitArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !/^\d*$/.test(s));

// --- Property Tests ---

describe('Feature: registration-and-password-reset, Property 1: Length validator accepts if and only if string length is within bounds', () => {
  /**
   * **Validates: Requirements 4.1, 4.3, 4.7, 8.1, 8.3, 8.5**
   *
   * For any string s and valid bounds [min, max] where min <= max,
   * lengthValidator(min, max)(s) returns null iff min <= s.length <= max,
   * else a non-null error string.
   */
  it('accepts strings within bounds and rejects strings outside bounds', () => {
    fc.assert(
      fc.property(boundsArb, stringArb, ({ min, max }, s) => {
        const result = lengthValidator(min, max)(s);
        const withinBounds = s.length >= min && s.length <= max;

        if (withinBounds) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        }
      }),
      { numRuns: 200 }
    );
  });
});

describe('Feature: registration-and-password-reset, Property 2: Character-set validator accepts if and only if all characters match the allowed pattern', () => {
  /**
   * **Validates: Requirements 4.2, 4.4, 4.8, 8.2, 8.4, 8.6**
   *
   * For any string s and regex pattern p, charsetValidator(p)(s) returns null
   * iff every character in s matches p, else a non-null error string.
   */
  it('accepts strings where all characters match the pattern', () => {
    const pattern = /[a-zA-Z0-9]/;

    fc.assert(
      fc.property(alphanumStringArb, (s) => {
        const result = charsetValidator(pattern)(s);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('rejects strings containing at least one character that does not match the pattern', () => {
    const pattern = /[a-zA-Z0-9]/;

    fc.assert(
      fc.property(stringWithInvalidCharArb, (s) => {
        const result = charsetValidator(pattern)(s);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
      }),
      { numRuns: 200 }
    );
  });

  it('accepts empty string for any pattern (vacuously true)', () => {
    const pattern = /[a-zA-Z0-9]/;
    expect(charsetValidator(pattern)('')).toBeNull();
  });
});

describe('Feature: registration-and-password-reset, Property 3: Email validator rejects strings that exceed max length or lack valid email structure', () => {
  /**
   * **Validates: Requirements 4.6**
   *
   * For any string s, emailValidator()(s) returns null iff s.length <= 30
   * AND s has exactly one @ with non-empty local and domain parts.
   */

  /** Generates a valid email: local@domain where total length <= 30 */
  const validEmailArb = fc
    .tuple(
      fc.stringMatching(/^[a-z]{1,10}$/),
      fc.stringMatching(/^[a-z]{1,10}$/)
    )
    .map(([local, domain]) => `${local}@${domain}`)
    .filter((e) => e.length <= 30);

  it('accepts valid emails (length <= 30, exactly one @, non-empty local and domain)', () => {
    fc.assert(
      fc.property(validEmailArb, (email) => {
        const result = emailValidator()(email);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('rejects strings longer than 30 characters', () => {
    const longStringArb = fc.string({ minLength: 31, maxLength: 60 });

    fc.assert(
      fc.property(longStringArb, (s) => {
        const result = emailValidator()(s);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects strings with no @ symbol', () => {
    const noAtArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('@'));

    fc.assert(
      fc.property(noAtArb, (s) => {
        const result = emailValidator()(s);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects strings with multiple @ symbols', () => {
    const multiAtArb = fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{1,5}$/)
      )
      .map(([a, b, c]) => `${a}@${b}@${c}`)
      .filter((s) => s.length <= 30);

    fc.assert(
      fc.property(multiAtArb, (s) => {
        const result = emailValidator()(s);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects strings with empty local or domain part', () => {
    // Empty local: @domain
    const emptyLocalArb = fc.stringMatching(/^[a-z]{1,10}$/).map((d) => `@${d}`);
    // Empty domain: local@
    const emptyDomainArb = fc.stringMatching(/^[a-z]{1,10}$/).map((l) => `${l}@`);

    fc.assert(
      fc.property(emptyLocalArb, (s) => {
        const result = emailValidator()(s);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(emptyDomainArb, (s) => {
        const result = emailValidator()(s);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: registration-and-password-reset, Property 4: Password match validator rejects if and only if the two strings differ', () => {
  /**
   * **Validates: Requirements 11.4**
   *
   * For any two strings a and b, matchValidator('fieldB')({fieldA: a, fieldB: b})(a)
   * returns null iff a === b, else non-null.
   */
  it('accepts when values match and rejects when they differ', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const values = { fieldA: a, fieldB: b };
        const validator = matchValidator('fieldB');
        const resolvedValidator = validator(values);
        const result = resolvedValidator(a);

        if (a === b) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        }
      }),
      { numRuns: 200 }
    );
  });

  it('always accepts when the same string is used for both fields', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const values = { fieldA: s, fieldB: s };
        const validator = matchValidator('fieldB');
        const resolvedValidator = validator(values);
        const result = resolvedValidator(s);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: registration-and-password-reset, Property 6: Validation engine returns errors only for fields that fail rules', () => {
  /**
   * **Validates: Requirements 4.1–4.8, 8.1–8.6**
   *
   * For any set of field rules and values, validate() returns valid:true with
   * empty errors iff all validators pass. If any fail, valid is false and errors
   * contain exactly the fields whose first failing validator produced a message.
   */

  it('returns valid:true with empty errors when all validators pass', () => {
    // Use lengthValidator with bounds that accept the generated strings
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s)),
            fc.string({ minLength: 1, maxLength: 50 })
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (fieldEntries) => {
          // Create rules where validators always pass (length 0-100)
          const rules: ExtendedFieldRule[] = fieldEntries.map(([name, value]) => ({
            fieldName: name,
            validators: [lengthValidator(0, 100)],
          }));
          const values: Record<string, string> = {};
          for (const [name, value] of fieldEntries) {
            values[name] = value;
          }

          const result = validate(rules, values);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid:false with errors for exactly the failing fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 15 }),
        fc.string({ minLength: 0, maxLength: 3 }),
        (goodValue, badValue) => {
          // goodField has a value within [0, 50] bounds → passes
          // badField has a value checked against [5, 15] bounds → fails (length 0-3 < 5)
          const rules: ExtendedFieldRule[] = [
            { fieldName: 'goodField', validators: [lengthValidator(0, 50)] },
            { fieldName: 'badField', validators: [lengthValidator(5, 15)] },
          ];
          const values = { goodField: goodValue, badField: badValue };

          const result = validate(rules, values);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('badField');
          expect(result.errors).not.toHaveProperty('goodField');
          expect(typeof result.errors['badField']).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('short-circuits on first failure per field (only first error message kept)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 3 }), (shortValue) => {
        // Two validators that will both fail, but only first error should be reported
        const rules: ExtendedFieldRule[] = [
          {
            fieldName: 'testField',
            validators: [
              lengthValidator(5, 15), // Will fail first
              charsetValidator(/[A-Z]/), // Would also fail but should not be reached
            ],
          },
        ];
        const values = { testField: shortValue };

        const result = validate(rules, values);
        expect(result.valid).toBe(false);
        expect(result.errors['testField']).toContain('between');
      }),
      { numRuns: 100 }
    );
  });

  it('supports context-aware validators (matchValidator) in validate()', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (password, confirm) => {
        const rules: ExtendedFieldRule[] = [
          {
            fieldName: 'confirmPassword',
            validators: [matchValidator('password')],
          },
        ];
        const values = { password, confirmPassword: confirm };

        const result = validate(rules, values);

        if (password === confirm) {
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        } else {
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('confirmPassword');
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: registration-and-password-reset, Property 7: Phone number validator accepts exactly 10-digit strings', () => {
  /**
   * **Validates: Requirements 4.5**
   *
   * For any string s, phoneValidator()(s) returns null iff s matches /^\d{10}$/.
   */
  it('accepts exactly 10-digit strings', () => {
    fc.assert(
      fc.property(tenDigitStringArb, (s) => {
        const result = phoneValidator()(s);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('rejects digit-only strings with length != 10', () => {
    fc.assert(
      fc.property(nonTenDigitStringArb, (s) => {
        const result = phoneValidator()(s);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
      }),
      { numRuns: 200 }
    );
  });

  it('rejects strings containing non-digit characters', () => {
    fc.assert(
      fc.property(stringWithNonDigitArb, (s) => {
        const result = phoneValidator()(s);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
      }),
      { numRuns: 200 }
    );
  });
});
