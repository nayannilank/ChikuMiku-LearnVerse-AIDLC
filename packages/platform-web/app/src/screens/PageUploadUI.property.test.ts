/**
 * Property Test: Upload Validation Constraints
 *
 * Property 11: For any uploaded image file, the system SHALL reject files
 * exceeding 10 MB; for any chapter, the total page count SHALL never exceed 50;
 * attempts to upload beyond 50 pages SHALL be rejected.
 *
 * **Validates: Requirements 8.4, 8.5, 8.6**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateFileSize, validatePageCount } from './PageUploadUI';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES_PER_CHAPTER = 50;

describe('Property 11: Upload Validation Constraints', () => {
  describe('File size validation (Requirements 8.4, 8.5)', () => {
    it('accepts files with size <= 10MB (returns null)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }),
          (fileSizeBytes) => {
            const result = validateFileSize(fileSizeBytes);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 500 }
      );
    });

    it('rejects files with size > 10MB (returns non-null error string)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: 50 * 1024 * 1024 }),
          (fileSizeBytes) => {
            const result = validateFileSize(fileSizeBytes);
            expect(result).not.toBeNull();
            expect(typeof result).toBe('string');
          }
        ),
        { numRuns: 500 }
      );
    });

    it('generates random file sizes (0 to 50MB) and validates boundary correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 * 1024 * 1024 }),
          (fileSizeBytes) => {
            const result = validateFileSize(fileSizeBytes);

            if (fileSizeBytes <= MAX_FILE_SIZE_BYTES) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(typeof result).toBe('string');
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Page count validation (Requirement 8.6)', () => {
    it('accepts page counts when current + adding <= 50 (returns null)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MAX_PAGES_PER_CHAPTER }),
          fc.integer({ min: 0, max: MAX_PAGES_PER_CHAPTER }),
          (currentCount, addingCount) => {
            fc.pre(currentCount + addingCount <= MAX_PAGES_PER_CHAPTER);
            const result = validatePageCount(currentCount, addingCount);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 500 }
      );
    });

    it('rejects page counts when current + adding > 50 (returns non-null error string)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (currentCount, addingCount) => {
            fc.pre(currentCount + addingCount > MAX_PAGES_PER_CHAPTER);
            const result = validatePageCount(currentCount, addingCount);
            expect(result).not.toBeNull();
            expect(typeof result).toBe('string');
          }
        ),
        { numRuns: 500 }
      );
    });

    it('generates random page counts (0-100) and validates boundary correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (currentCount, addingCount) => {
            const result = validatePageCount(currentCount, addingCount);

            if (currentCount + addingCount <= MAX_PAGES_PER_CHAPTER) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(typeof result).toBe('string');
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
