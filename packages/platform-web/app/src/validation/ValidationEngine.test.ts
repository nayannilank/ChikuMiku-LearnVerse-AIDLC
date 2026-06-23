/**
 * Unit Tests: ValidationEngine
 *
 * Tests each validator with specific edge cases (boundary lengths, empty strings,
 * special characters) and verifies the validate() function returns the correct
 * ValidationResult shape.
 *
 * **Validates: Requirements 4.1–4.9, 8.1–8.8, 11.2–11.4**
 */
import { describe, it, expect } from 'vitest';
import {
  lengthValidator,
  charsetValidator,
  emailValidator,
  phoneValidator,
  requiredValidator,
  matchValidator,
  validate,
  type ExtendedFieldRule,
} from './ValidationEngine';

// =============================================================================
// lengthValidator
// =============================================================================

describe('lengthValidator', () => {
  /**
   * Validates: Requirements 4.1, 4.3, 4.7, 8.1, 8.3, 8.5, 11.2
   */

  it('accepts string at exactly min length', () => {
    const validator = lengthValidator(8, 15);
    expect(validator('abcdefgh')).toBeNull(); // length 8 === min
  });

  it('rejects string at min-1 length', () => {
    const validator = lengthValidator(8, 15);
    expect(validator('abcdefg')).not.toBeNull(); // length 7 < 8
  });

  it('accepts string at exactly max length', () => {
    const validator = lengthValidator(8, 15);
    expect(validator('abcdefghijklmno')).toBeNull(); // length 15 === max
  });

  it('rejects string at max+1 length', () => {
    const validator = lengthValidator(8, 15);
    expect(validator('abcdefghijklmnop')).not.toBeNull(); // length 16 > 15
  });

  it('rejects empty string when min > 0', () => {
    const validator = lengthValidator(1, 10);
    expect(validator('')).not.toBeNull();
  });

  it('accepts empty string when min is 0', () => {
    const validator = lengthValidator(0, 10);
    expect(validator('')).toBeNull();
  });

  it('accepts string within range (Req 4.3: Name 5-20)', () => {
    const validator = lengthValidator(5, 20);
    expect(validator('Hello')).toBeNull(); // length 5, at min
    expect(validator('A name with spaces!!')).toBeNull(); // length 20, at max
  });

  it('rejects string outside range (Req 4.7: Password 8-20)', () => {
    const validator = lengthValidator(8, 20);
    expect(validator('short')).not.toBeNull(); // length 5 < 8
    expect(validator('a'.repeat(21))).not.toBeNull(); // length 21 > 20
  });

  it('error message includes the bounds', () => {
    const validator = lengthValidator(5, 20);
    const error = validator('abc');
    expect(error).toContain('5');
    expect(error).toContain('20');
  });
});

// =============================================================================
// charsetValidator
// =============================================================================

describe('charsetValidator', () => {
  /**
   * Validates: Requirements 4.2, 4.4, 4.8, 8.2, 8.4, 8.6, 11.3
   */

  it('accepts empty string (vacuously true)', () => {
    const validator = charsetValidator(/[a-zA-Z0-9_-]/);
    expect(validator('')).toBeNull();
  });

  it('accepts all valid chars (Req 4.2: alphabets, numbers, hyphens, underscores)', () => {
    const validator = charsetValidator(/[a-zA-Z0-9_-]/);
    expect(validator('User-Name_123')).toBeNull();
  });

  it('rejects single invalid character', () => {
    const validator = charsetValidator(/[a-zA-Z0-9_-]/);
    expect(validator('!')).not.toBeNull();
  });

  it('rejects string with mixed valid/invalid chars', () => {
    const validator = charsetValidator(/[a-zA-Z0-9_-]/);
    expect(validator('abc$def')).not.toBeNull();
  });

  it('rejects unicode characters when pattern allows only ASCII', () => {
    const validator = charsetValidator(/[a-zA-Z0-9_-]/);
    expect(validator('café')).not.toBeNull(); // é is invalid
  });

  it('accepts only alphabets and spaces (Req 4.4: Name charset)', () => {
    const validator = charsetValidator(/[a-zA-Z ]/);
    expect(validator('John Doe')).toBeNull();
  });

  it('rejects digits in name charset (Req 4.4)', () => {
    const validator = charsetValidator(/[a-zA-Z ]/);
    expect(validator('John3')).not.toBeNull();
  });

  it('accepts school name charset (Req 8.6: alphabets, spaces, commas, hyphens)', () => {
    const validator = charsetValidator(/[a-zA-Z ,\-]/);
    expect(validator('St Mary, High-School')).toBeNull();
  });

  it('rejects special symbols not in school name charset (Req 8.6)', () => {
    const validator = charsetValidator(/[a-zA-Z ,\-]/);
    expect(validator('School#1')).not.toBeNull();
  });
});

// =============================================================================
// emailValidator
// =============================================================================

describe('emailValidator', () => {
  /**
   * Validates: Requirement 4.6
   */

  it('accepts valid email within 30 chars', () => {
    const validator = emailValidator();
    expect(validator('user@example.com')).toBeNull();
  });

  it('accepts email at exactly 30 characters', () => {
    const validator = emailValidator();
    // local(14) + @ + domain with dot(15) = 30 chars
    const email = 'a'.repeat(14) + '@' + 'b'.repeat(11) + '.com';
    expect(email.length).toBe(30);
    expect(validator(email)).toBeNull();
  });

  it('rejects email at 31 characters', () => {
    const validator = emailValidator();
    const email = 'a'.repeat(15) + '@' + 'b'.repeat(15);
    expect(email.length).toBe(31);
    expect(validator(email)).not.toBeNull();
  });

  it('rejects empty string', () => {
    const validator = emailValidator();
    expect(validator('')).not.toBeNull();
  });

  it('rejects string with no @ symbol', () => {
    const validator = emailValidator();
    expect(validator('userexample.com')).not.toBeNull();
  });

  it('rejects string with multiple @ symbols', () => {
    const validator = emailValidator();
    expect(validator('user@@example.com')).not.toBeNull();
    expect(validator('a@b@c')).not.toBeNull();
  });

  it('rejects empty local part (@domain)', () => {
    const validator = emailValidator();
    expect(validator('@domain.com')).not.toBeNull();
  });

  it('rejects empty domain part (local@)', () => {
    const validator = emailValidator();
    expect(validator('user@')).not.toBeNull();
  });

  it('rejects just the @ character', () => {
    const validator = emailValidator();
    expect(validator('@')).not.toBeNull();
  });
});

// =============================================================================
// phoneValidator
// =============================================================================

describe('phoneValidator', () => {
  /**
   * Validates: Requirement 4.5
   */

  it('accepts exactly 10 digits', () => {
    const validator = phoneValidator();
    expect(validator('1234567890')).toBeNull();
  });

  it('rejects 9 digits', () => {
    const validator = phoneValidator();
    expect(validator('123456789')).not.toBeNull();
  });

  it('rejects 11 digits', () => {
    const validator = phoneValidator();
    expect(validator('12345678901')).not.toBeNull();
  });

  it('rejects digits with spaces', () => {
    const validator = phoneValidator();
    expect(validator('123 456 7890')).not.toBeNull();
  });

  it('accepts leading zeros', () => {
    const validator = phoneValidator();
    expect(validator('0000000000')).toBeNull();
  });

  it('rejects letters mixed in', () => {
    const validator = phoneValidator();
    expect(validator('12345abcde')).not.toBeNull();
  });

  it('rejects empty string', () => {
    const validator = phoneValidator();
    expect(validator('')).not.toBeNull();
  });
});

// =============================================================================
// requiredValidator
// =============================================================================

describe('requiredValidator', () => {
  /**
   * Validates: Requirements 8.7 (Grade required)
   */

  it('rejects empty string', () => {
    const validator = requiredValidator();
    expect(validator('')).not.toBeNull();
  });

  it('rejects whitespace-only string (spaces)', () => {
    const validator = requiredValidator();
    expect(validator('   ')).not.toBeNull();
  });

  it('rejects whitespace-only string (tabs)', () => {
    const validator = requiredValidator();
    expect(validator('\t\t')).not.toBeNull();
  });

  it('rejects whitespace-only string (mixed)', () => {
    const validator = requiredValidator();
    expect(validator(' \t \n ')).not.toBeNull();
  });

  it('accepts non-empty string', () => {
    const validator = requiredValidator();
    expect(validator('hello')).toBeNull();
  });

  it('accepts single character', () => {
    const validator = requiredValidator();
    expect(validator('a')).toBeNull();
  });

  it('accepts string with leading/trailing spaces but non-whitespace content', () => {
    const validator = requiredValidator();
    expect(validator('  x  ')).toBeNull();
  });
});

// =============================================================================
// matchValidator
// =============================================================================

describe('matchValidator', () => {
  /**
   * Validates: Requirement 11.4 (New password must match confirm password)
   */

  it('accepts when values match', () => {
    const validator = matchValidator('password');
    const values = { password: 'Secret123', confirmPassword: 'Secret123' };
    const resolvedFn = validator(values);
    expect(resolvedFn('Secret123')).toBeNull();
  });

  it('rejects when values do not match', () => {
    const validator = matchValidator('password');
    const values = { password: 'Secret123', confirmPassword: 'Different' };
    const resolvedFn = validator(values);
    expect(resolvedFn('Different')).not.toBeNull();
  });

  it('accepts when both are empty strings', () => {
    const validator = matchValidator('password');
    const values = { password: '', confirmPassword: '' };
    const resolvedFn = validator(values);
    expect(resolvedFn('')).toBeNull();
  });

  it('rejects when other field is missing from values map (undefined vs string)', () => {
    const validator = matchValidator('password');
    const values = { confirmPassword: 'something' } as Record<string, string>;
    const resolvedFn = validator(values);
    // values['password'] is undefined, comparing 'something' !== undefined → error
    expect(resolvedFn('something')).not.toBeNull();
  });

  it('error message includes the other field name', () => {
    const validator = matchValidator('newPassword');
    const values = { newPassword: 'abc', confirmPassword: 'xyz' };
    const resolvedFn = validator(values);
    const error = resolvedFn('xyz');
    expect(error).toContain('newPassword');
  });
});

// =============================================================================
// validate() function
// =============================================================================

describe('validate()', () => {
  /**
   * Validates: Requirements 4.1–4.8, 8.1–8.6, 11.2–11.4
   */

  it('returns { valid: true, errors: {} } when all validators pass', () => {
    const rules: ExtendedFieldRule[] = [
      { fieldName: 'username', validators: [lengthValidator(3, 10)] },
      { fieldName: 'name', validators: [lengthValidator(2, 20)] },
    ];
    const values = { username: 'hello', name: 'World' };

    const result = validate(rules, values);
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('returns { valid: false, errors: {...} } with first error per field', () => {
    const rules: ExtendedFieldRule[] = [
      { fieldName: 'username', validators: [lengthValidator(8, 15)] },
    ];
    const values = { username: 'short' };

    const result = validate(rules, values);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('username');
    expect(typeof result.errors['username']).toBe('string');
  });

  it('short-circuits: stops at first error per field', () => {
    // First validator fails, second should not run
    const rules: ExtendedFieldRule[] = [
      {
        fieldName: 'username',
        validators: [
          lengthValidator(10, 15), // fails for 'abc' (too short)
          charsetValidator(/[A-Z]/), // would also fail but never reached
        ],
      },
    ];
    const values = { username: 'abc' };

    const result = validate(rules, values);
    expect(result.valid).toBe(false);
    // Error should be from lengthValidator, not charsetValidator
    expect(result.errors['username']).toContain('between');
    expect(result.errors['username']).not.toContain('invalid characters');
  });

  it('handles missing field values by defaulting to empty string', () => {
    const rules: ExtendedFieldRule[] = [
      { fieldName: 'missingField', validators: [requiredValidator()] },
    ];
    const values = {}; // missingField not present

    const result = validate(rules, values);
    expect(result.valid).toBe(false);
    expect(result.errors['missingField']).toContain('required');
  });

  it('handles context-aware validators (matchValidator)', () => {
    const rules: ExtendedFieldRule[] = [
      {
        fieldName: 'confirmPassword',
        validators: [matchValidator('newPassword')],
      },
    ];
    const values = { newPassword: 'Secret1!', confirmPassword: 'Different' };

    const result = validate(rules, values);
    expect(result.valid).toBe(false);
    expect(result.errors['confirmPassword']).toContain('newPassword');
  });

  it('reports errors for multiple fields independently', () => {
    const rules: ExtendedFieldRule[] = [
      { fieldName: 'username', validators: [lengthValidator(8, 15)] },
      { fieldName: 'name', validators: [lengthValidator(5, 20)] },
      { fieldName: 'phone', validators: [phoneValidator()] },
    ];
    const values = { username: 'ok12345678', name: 'Jo', phone: '123' };
    // username passes (length 10), name fails (length 2 < 5), phone fails (3 digits)

    const result = validate(rules, values);
    expect(result.valid).toBe(false);
    expect(result.errors).not.toHaveProperty('username');
    expect(result.errors).toHaveProperty('name');
    expect(result.errors).toHaveProperty('phone');
  });

  it('handles a complete parent registration validation scenario', () => {
    const rules: ExtendedFieldRule[] = [
      {
        fieldName: 'username',
        validators: [lengthValidator(8, 15), charsetValidator(/[a-zA-Z0-9_-]/)],
      },
      {
        fieldName: 'name',
        validators: [lengthValidator(5, 20), charsetValidator(/[a-zA-Z ]/)],
      },
      {
        fieldName: 'phone',
        validators: [phoneValidator()],
      },
      {
        fieldName: 'email',
        validators: [emailValidator()],
      },
      {
        fieldName: 'password',
        validators: [lengthValidator(8, 20), charsetValidator(/[a-zA-Z0-9!@#$%^&*]/)],
      },
    ];
    const values = {
      username: 'parent_user',
      name: 'John Doe',
      phone: '9876543210',
      email: 'john@example.com',
      password: 'Secure123!',
    };

    const result = validate(rules, values);
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('handles empty rules array', () => {
    const result = validate([], { anyField: 'anyValue' });
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('handles empty values with no rules', () => {
    const result = validate([], {});
    expect(result).toEqual({ valid: true, errors: {} });
  });
});
