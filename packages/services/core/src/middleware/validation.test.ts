import { describe, it, expect } from 'vitest';
import { validateBody, validateField } from './validation.js';
import { ServiceError } from './errorHandler.js';
import type { ValidationSchema } from './validation.js';

describe('validateBody', () => {
  const schema: ValidationSchema = {
    name: { required: true, type: 'string', minLength: 3, maxLength: 20 },
    age: { required: false, type: 'number', min: 0, max: 150 },
  };

  it('parses and validates a valid body', () => {
    const result = validateBody<{ name: string; age: number }>(
      JSON.stringify({ name: 'Alice', age: 25 }),
      schema,
    );

    expect(result.name).toBe('Alice');
    expect(result.age).toBe(25);
  });

  it('throws on null body', () => {
    expect(() => validateBody(null, schema)).toThrow(ServiceError);
    try {
      validateBody(null, schema);
    } catch (e) {
      expect((e as ServiceError).statusCode).toBe(400);
      expect((e as ServiceError).errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('throws on empty string body', () => {
    expect(() => validateBody('', schema)).toThrow(ServiceError);
  });

  it('throws on invalid JSON', () => {
    expect(() => validateBody('{invalid', schema)).toThrow(ServiceError);
  });

  it('throws on non-object JSON (array)', () => {
    expect(() => validateBody('[1,2,3]', schema)).toThrow(ServiceError);
  });

  it('collects field errors when validation fails', () => {
    try {
      validateBody(JSON.stringify({ name: 'Al' }), schema);
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      const se = e as ServiceError;
      expect(se.errorCode).toBe('VALIDATION_ERROR');
      expect(se.fieldErrors).toBeDefined();
      expect(se.fieldErrors!.some(f => f.field === 'name')).toBe(true);
    }
  });

  it('allows optional fields to be absent', () => {
    const result = validateBody<{ name: string }>(
      JSON.stringify({ name: 'ValidName' }),
      schema,
    );
    expect(result.name).toBe('ValidName');
  });
});

describe('validateField', () => {
  it('returns error for required missing field', () => {
    const result = validateField(undefined, { required: true });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('required');
  });

  it('returns null for optional missing field', () => {
    const result = validateField(undefined, { required: false });
    expect(result).toBeNull();
  });

  it('validates type mismatch', () => {
    const result = validateField(123, { type: 'string' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('string');
  });

  it('validates string minLength', () => {
    const result = validateField('ab', { type: 'string', minLength: 3 });
    expect(result).not.toBeNull();
  });

  it('validates string maxLength', () => {
    const result = validateField('too long value here', { type: 'string', maxLength: 5 });
    expect(result).not.toBeNull();
  });

  it('validates string pattern as RegExp', () => {
    const result = validateField('abc!', { type: 'string', pattern: /^[a-z]+$/ });
    expect(result).not.toBeNull();
  });

  it('validates string pattern as string', () => {
    const result = validateField('123', { type: 'string', pattern: '^[a-z]+$' });
    expect(result).not.toBeNull();
  });

  it('passes valid string with pattern', () => {
    const result = validateField('hello', { type: 'string', pattern: /^[a-z]+$/ });
    expect(result).toBeNull();
  });

  it('validates number min', () => {
    const result = validateField(-1, { type: 'number', min: 0 });
    expect(result).not.toBeNull();
  });

  it('validates number max', () => {
    const result = validateField(200, { type: 'number', max: 150 });
    expect(result).not.toBeNull();
  });

  it('passes valid number within range', () => {
    const result = validateField(42, { type: 'number', min: 0, max: 100 });
    expect(result).toBeNull();
  });

  it('uses custom errorMessage when provided', () => {
    const result = validateField('', { required: true, errorMessage: 'Name is needed' });
    expect(result!.message).toBe('Name is needed');
  });
});
