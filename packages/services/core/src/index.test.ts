import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as core from './index';

describe('core package setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should have fast-check configured correctly', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      }),
      { numRuns: 100 }
    );
  });

  it('should export types and validation functions', () => {
    expect(core.validateGrade).toBeDefined();
    expect(core.validateImageInput).toBeDefined();
    expect(core.MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(core.MAX_PAGES_PER_CHAPTER).toBe(50);
    expect(core.MAX_QUEUED_ACTIONS).toBe(50);
  });
});
