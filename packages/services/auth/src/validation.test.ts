import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
  ValidationResponse,
} from './validation';

describe('validateUsername', () => {
  it('accepts a valid username with letters and digits', () => {
    const result = validateUsername('user123');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts username at minimum length (5 chars)', () => {
    const result = validateUsername('abcde');
    expect(result.valid).toBe(true);
  });

  it('accepts username at maximum length (15 chars)', () => {
    const result = validateUsername('abcdefghijklmno');
    expect(result.valid).toBe(true);
  });

  it('accepts username with underscores and hyphens', () => {
    const result = validateUsername('user_name-1');
    expect(result.valid).toBe(true);
  });

  it('rejects username shorter than 5 characters', () => {
    const result = validateUsername('abcd');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects username longer than 15 characters', () => {
    const result = validateUsername('abcdefghijklmnop');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects username with spaces', () => {
    const result = validateUsername('user name');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects username with special characters', () => {
    const result = validateUsername('user@name');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects empty string', () => {
    const result = validateUsername('');
    expect(result.valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a valid password meeting all criteria', () => {
    const result = validatePassword('Pass1word!');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts password at minimum length (8 chars)', () => {
    const result = validatePassword('Aa1!xxxx');
    expect(result.valid).toBe(true);
  });

  it('accepts password at maximum length (20 chars)', () => {
    const result = validatePassword('Aa1!xxxxxxxxxxxxxxxx');
    expect(result.valid).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = validatePassword('Aa1!xxx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('8');
  });

  it('rejects password longer than 20 characters', () => {
    const result = validatePassword('Aa1!xxxxxxxxxxxxxxxxx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('20');
  });

  it('rejects password without uppercase letter', () => {
    const result = validatePassword('aa1!xxxx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('uppercase');
  });

  it('rejects password without lowercase letter', () => {
    const result = validatePassword('AA1!XXXX');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('rejects password without digit', () => {
    const result = validatePassword('Aaaa!xxx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('digit');
  });

  it('rejects password without special character', () => {
    const result = validatePassword('Aa1xxxxx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('special');
  });
});

describe('validateEmail', () => {
  it('accepts a valid email address', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts email with subdomain', () => {
    const result = validateEmail('user@mail.example.com');
    expect(result.valid).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects email without @', () => {
    const result = validateEmail('userexample.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects email without domain dot', () => {
    const result = validateEmail('user@example');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects email exceeding 254 characters', () => {
    const longLocal = 'a'.repeat(243);
    const email = `${longLocal}@example.com`; // 255 chars
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('254');
  });

  it('accepts email at exactly 254 characters', () => {
    const longLocal = 'a'.repeat(242);
    const email = `${longLocal}@example.com`; // 254 chars
    expect(email.length).toBe(254);
    const result = validateEmail(email);
    expect(result.valid).toBe(true);
  });

  it('rejects email with @ at position 0 (empty local part)', () => {
    const result = validateEmail('@example.com');
    expect(result.valid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts a valid 10-digit phone number', () => {
    const result = validatePhone('9876543210');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects phone with fewer than 10 digits', () => {
    const result = validatePhone('987654321');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects phone with more than 10 digits', () => {
    const result = validatePhone('98765432101');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects phone with country code prefix', () => {
    const result = validatePhone('+919876543210');
    expect(result.valid).toBe(false);
  });

  it('rejects phone with hyphens', () => {
    const result = validatePhone('987-654-3210');
    expect(result.valid).toBe(false);
  });

  it('rejects phone with spaces', () => {
    const result = validatePhone('987 654 3210');
    expect(result.valid).toBe(false);
  });

  it('rejects phone with letters', () => {
    const result = validatePhone('98765abcde');
    expect(result.valid).toBe(false);
  });

  it('rejects empty string', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(false);
  });
});
