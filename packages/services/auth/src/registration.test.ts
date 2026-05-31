import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  validatePhoneNumber,
  validateDisplayName,
  validateRegistrationInput,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  RegistrationInput,
} from './registration';

describe('validatePassword', () => {
  it('accepts a valid password with letters and digits', () => {
    const result = validatePassword('hello123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('hello123');
    }
  });

  it('accepts password at minimum length (8 chars)', () => {
    const result = validatePassword('abcdef1x');
    expect(result.success).toBe(true);
  });

  it('accepts password at maximum length (128 chars)', () => {
    const password = 'a'.repeat(127) + '1';
    const result = validatePassword(password);
    expect(result.success).toBe(true);
  });

  it('accepts password with mixed case and special characters', () => {
    const result = validatePassword('P@ssw0rd!#$');
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = validatePassword('abc1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(`${MIN_PASSWORD_LENGTH}`);
    }
  });

  it('rejects password longer than 128 characters', () => {
    const password = 'a'.repeat(128) + '1';
    const result = validatePassword(password);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(`${MAX_PASSWORD_LENGTH}`);
    }
  });

  it('rejects password without any letter', () => {
    const result = validatePassword('12345678');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('letter');
    }
  });

  it('rejects password without any digit', () => {
    const result = validatePassword('abcdefgh');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('digit');
    }
  });

  it('rejects empty password', () => {
    const result = validatePassword('');
    expect(result.success).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    const result = validateEmail('user@example.com');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('user@example.com');
    }
  });

  it('accepts email with subdomain', () => {
    const result = validateEmail('user@mail.example.co.in');
    expect(result.success).toBe(true);
  });

  it('accepts email with plus addressing', () => {
    const result = validateEmail('user+tag@example.com');
    expect(result.success).toBe(true);
  });

  it('trims whitespace from email', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('user@example.com');
    }
  });

  it('rejects email without @ symbol', () => {
    const result = validateEmail('userexample.com');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('invalid');
    }
  });

  it('rejects email without domain dot', () => {
    const result = validateEmail('user@example');
    expect(result.success).toBe(false);
  });

  it('rejects empty email', () => {
    const result = validateEmail('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('empty');
    }
  });

  it('rejects email with spaces in middle', () => {
    const result = validateEmail('user @example.com');
    expect(result.success).toBe(false);
  });
});

describe('validatePhoneNumber', () => {
  it('accepts a valid phone number with country code', () => {
    const result = validatePhoneNumber('+919876543210');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('+919876543210');
    }
  });

  it('accepts phone number with hyphens', () => {
    const result = validatePhoneNumber('+91-98765-43210');
    expect(result.success).toBe(true);
  });

  it('accepts phone number with parentheses', () => {
    const result = validatePhoneNumber('(123) 456-7890');
    expect(result.success).toBe(true);
  });

  it('accepts phone number with spaces', () => {
    const result = validatePhoneNumber('+1 234 567 8901');
    expect(result.success).toBe(true);
  });

  it('accepts phone number with exactly 7 digits', () => {
    const result = validatePhoneNumber('1234567');
    expect(result.success).toBe(true);
  });

  it('accepts phone number with exactly 15 digits', () => {
    const result = validatePhoneNumber('123456789012345');
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = validatePhoneNumber('  +919876543210  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('+919876543210');
    }
  });

  it('rejects phone number with fewer than 7 digits', () => {
    const result = validatePhoneNumber('123456');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('7 digits');
    }
  });

  it('rejects phone number with more than 15 digits', () => {
    const result = validatePhoneNumber('1234567890123456');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('15 digits');
    }
  });

  it('rejects empty phone number', () => {
    const result = validatePhoneNumber('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('empty');
    }
  });

  it('rejects phone number with letters', () => {
    const result = validatePhoneNumber('+1-800-FLOWERS');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('invalid characters');
    }
  });
});

describe('validateDisplayName', () => {
  it('accepts a valid display name', () => {
    const result = validateDisplayName('Chiku');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('Chiku');
    }
  });

  it('trims whitespace', () => {
    const result = validateDisplayName('  Miku  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('Miku');
    }
  });

  it('rejects empty display name', () => {
    const result = validateDisplayName('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('empty');
    }
  });

  it('rejects whitespace-only display name', () => {
    const result = validateDisplayName('   ');
    expect(result.success).toBe(false);
  });
});

describe('validateRegistrationInput', () => {
  const validInput: RegistrationInput = {
    contactType: 'email',
    contactValue: 'learner@example.com',
    password: 'secure1pass',
    grade: 5,
    displayName: 'Chiku',
  };

  it('accepts valid registration input with email', () => {
    const result = validateRegistrationInput(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.contactType).toBe('email');
      expect(result.value.contactValue).toBe('learner@example.com');
      expect(result.value.grade).toBe(5);
      expect(result.value.displayName).toBe('Chiku');
    }
  });

  it('accepts valid registration input with phone', () => {
    const input: RegistrationInput = {
      ...validInput,
      contactType: 'phone',
      contactValue: '+919876543210',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.contactType).toBe('phone');
      expect(result.value.contactValue).toBe('+919876543210');
    }
  });

  it('returns field-specific error for invalid email', () => {
    const input: RegistrationInput = {
      ...validInput,
      contactValue: 'not-an-email',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('contactValue');
    }
  });

  it('returns field-specific error for invalid phone', () => {
    const input: RegistrationInput = {
      ...validInput,
      contactType: 'phone',
      contactValue: '123',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'contactValue')).toBe(true);
    }
  });

  it('returns field-specific error for invalid password', () => {
    const input: RegistrationInput = {
      ...validInput,
      password: 'short',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('returns field-specific error for invalid grade', () => {
    const input: RegistrationInput = {
      ...validInput,
      grade: 15,
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'grade')).toBe(true);
    }
  });

  it('returns field-specific error for empty display name', () => {
    const input: RegistrationInput = {
      ...validInput,
      displayName: '',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'displayName')).toBe(true);
    }
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const input: RegistrationInput = {
      contactType: 'email',
      contactValue: 'bad-email',
      password: 'short',
      grade: 0,
      displayName: '',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain('contactValue');
      expect(fields).toContain('password');
      expect(fields).toContain('grade');
      expect(fields).toContain('displayName');
    }
  });

  it('preserves valid form data on validation failure', () => {
    const input: RegistrationInput = {
      contactType: 'email',
      contactValue: 'valid@example.com',
      password: 'short', // invalid
      grade: 5,
      displayName: 'Chiku',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.contactType).toBe('email');
      expect(result.preservedData.contactValue).toBe('valid@example.com');
      expect(result.preservedData.grade).toBe(5);
      expect(result.preservedData.displayName).toBe('Chiku');
    }
  });

  it('does not preserve invalid fields in preserved data', () => {
    const input: RegistrationInput = {
      contactType: 'email',
      contactValue: 'bad-email', // invalid
      password: 'secure1pass',
      grade: 5,
      displayName: 'Chiku',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.contactValue).toBeUndefined();
      expect(result.preservedData.contactType).toBe('email');
      expect(result.preservedData.grade).toBe(5);
      expect(result.preservedData.displayName).toBe('Chiku');
    }
  });

  it('returns error for invalid contact type', () => {
    const input = {
      contactType: 'fax' as any,
      contactValue: 'something',
      password: 'secure1pass',
      grade: 5,
      displayName: 'Chiku',
    };
    const result = validateRegistrationInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'contactType')).toBe(true);
    }
  });
});
