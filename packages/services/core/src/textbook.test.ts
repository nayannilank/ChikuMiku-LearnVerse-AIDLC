import { describe, it, expect } from 'vitest';
import { validateContentName } from './textbook';

describe('validateContentName', () => {
  it('accepts a simple valid name', () => {
    const result = validateContentName('Mathematics');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a single character name', () => {
    const result = validateContentName('A');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a name at the 200-character limit', () => {
    const name = 'a'.repeat(200);
    const result = validateContentName(name);
    expect(result).toEqual({ valid: true });
  });

  it('rejects an empty string', () => {
    const result = validateContentName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a string that is only whitespace', () => {
    const result = validateContentName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a name exceeding 200 characters after trim', () => {
    const name = 'a'.repeat(201);
    const result = validateContentName(name);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('trims leading/trailing whitespace before checking length', () => {
    const result = validateContentName('  Hello World  ');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a name with exactly 200 chars after trimming', () => {
    const name = '  ' + 'b'.repeat(200) + '  ';
    const result = validateContentName(name);
    expect(result).toEqual({ valid: true });
  });

  it('rejects a name with more than 200 chars after trimming', () => {
    const name = '  ' + 'c'.repeat(201) + '  ';
    const result = validateContentName(name);
    expect(result.valid).toBe(false);
  });
});
