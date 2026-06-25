/**
 * Unit tests for ContentIngestionScreen — validateContentName helper.
 *
 * Validates: Requirements 7.3, 7.5 (name 1-200 chars validation)
 */

import { describe, it, expect } from 'vitest';
import { validateContentName } from './ContentIngestionScreen';

describe('ContentIngestionScreen - validateContentName', () => {
  it('accepts a 1-character name', () => {
    expect(validateContentName('A')).toBeNull();
  });

  it('accepts a 200-character name', () => {
    const name = 'a'.repeat(200);
    expect(validateContentName(name)).toBeNull();
  });

  it('accepts a typical book name', () => {
    expect(validateContentName('Tili Kannada - Part 1')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(validateContentName('')).not.toBeNull();
  });

  it('rejects a whitespace-only string', () => {
    expect(validateContentName('   ')).not.toBeNull();
  });

  it('rejects a name exceeding 200 characters', () => {
    const name = 'b'.repeat(201);
    expect(validateContentName(name)).not.toBeNull();
  });

  it('trims whitespace before checking length', () => {
    // 1 real char + surrounding spaces = valid
    expect(validateContentName('  X  ')).toBeNull();
  });

  it('rejects trimmed name exceeding 200 characters', () => {
    const name = '  ' + 'c'.repeat(201) + '  ';
    expect(validateContentName(name)).not.toBeNull();
  });
});
