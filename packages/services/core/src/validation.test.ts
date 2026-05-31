import { describe, it, expect } from 'vitest';
import { validateGrade, validateImageInput } from './validation';
import { MAX_IMAGE_SIZE_BYTES } from './types';

describe('validateGrade', () => {
  it('accepts valid grades 1-12', () => {
    for (let g = 1; g <= 12; g++) {
      const result = validateGrade(g);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(g);
      }
    }
  });

  it('rejects grade 0', () => {
    const result = validateGrade(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('between 1 and 12');
    }
  });

  it('rejects grade 13', () => {
    const result = validateGrade(13);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('between 1 and 12');
    }
  });

  it('rejects negative numbers', () => {
    const result = validateGrade(-1);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer numbers', () => {
    const result = validateGrade(3.5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('integer');
    }
  });

  it('rejects non-number types', () => {
    expect(validateGrade('5').success).toBe(false);
    expect(validateGrade(null).success).toBe(false);
    expect(validateGrade(undefined).success).toBe(false);
    expect(validateGrade({}).success).toBe(false);
  });
});

describe('validateImageInput', () => {
  it('accepts valid jpeg image within size limit', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: 5_000_000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.format).toBe('jpeg');
      expect(result.value.sizeBytes).toBe(5_000_000);
    }
  });

  it('accepts valid png image', () => {
    const result = validateImageInput({ format: 'png', sizeBytes: 1_000 });
    expect(result.success).toBe(true);
  });

  it('accepts valid heic image', () => {
    const result = validateImageInput({ format: 'heic', sizeBytes: 8_000_000 });
    expect(result.success).toBe(true);
  });

  it('accepts image at exactly 10 MB', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: MAX_IMAGE_SIZE_BYTES });
    expect(result.success).toBe(true);
  });

  it('rejects image exceeding 10 MB', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: MAX_IMAGE_SIZE_BYTES + 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('10 MB');
    }
  });

  it('rejects unsupported format', () => {
    const result = validateImageInput({ format: 'gif', sizeBytes: 1_000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('jpeg');
      expect(result.error).toContain('png');
      expect(result.error).toContain('heic');
    }
  });

  it('rejects zero-size image', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('greater than 0');
    }
  });

  it('rejects negative size', () => {
    const result = validateImageInput({ format: 'png', sizeBytes: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects NaN size', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects Infinity size', () => {
    const result = validateImageInput({ format: 'jpeg', sizeBytes: Infinity });
    expect(result.success).toBe(false);
  });
});
