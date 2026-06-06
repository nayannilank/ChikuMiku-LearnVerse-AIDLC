import { describe, it, expect } from 'vitest';
import {
  addPageToChapter,
  ChapterPage,
  AddPageResult,
  MAX_PAGE_IMAGE_SIZE_BYTES,
} from './pageManagement';

describe('addPageToChapter', () => {
  const emptyPages: ChapterPage[] = [];
  const chapterId = 'chapter-123';

  describe('valid inputs', () => {
    it('adds a JPEG page to an empty array', () => {
      const result = addPageToChapter(emptyPages, '/images/page1.jpg', 500_000, 'jpeg', chapterId);
      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].imageUri).toBe('/images/page1.jpg');
      expect(result.pages[0].imageSizeBytes).toBe(500_000);
      expect(result.pages[0].imageFormat).toBe('jpeg');
      expect(result.pages[0].chapterId).toBe(chapterId);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('adds a PNG page to an empty array', () => {
      const result = addPageToChapter(emptyPages, '/images/page1.png', 1_000_000, 'png', chapterId);
      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].imageFormat).toBe('png');
    });

    it('auto-increments pageNumber when pages already exist', () => {
      const existingPages: ChapterPage[] = [
        {
          id: 'page-1',
          chapterId,
          imageUri: '/images/page1.jpg',
          imageSizeBytes: 500_000,
          imageFormat: 'jpeg',
          pageNumber: 1,
          createdAt: new Date(),
        },
      ];
      const result = addPageToChapter(existingPages, '/images/page2.png', 300_000, 'png', chapterId);
      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[1].pageNumber).toBe(2);
    });

    it('accepts an image at exactly 10 MB', () => {
      const result = addPageToChapter(emptyPages, '/images/big.jpg', MAX_PAGE_IMAGE_SIZE_BYTES, 'jpeg', chapterId);
      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].imageSizeBytes).toBe(MAX_PAGE_IMAGE_SIZE_BYTES);
    });

    it('returns a new array without mutating the original', () => {
      const original: ChapterPage[] = [];
      const result = addPageToChapter(original, '/images/page1.jpg', 100_000, 'jpeg', chapterId);
      expect(original).toHaveLength(0);
      expect(result.pages).toHaveLength(1);
      expect(result.pages).not.toBe(original);
    });
  });

  describe('invalid inputs - returns unchanged array with error', () => {
    it('rejects unsupported image format', () => {
      const result = addPageToChapter(emptyPages, '/images/page.heic', 500_000, 'heic', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.pages).toHaveLength(0);
      expect(result.error).toBeDefined();
    });

    it('rejects empty string format', () => {
      const result = addPageToChapter(emptyPages, '/images/page.jpg', 500_000, '', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toBeDefined();
    });

    it('rejects image size exceeding 10 MB', () => {
      const result = addPageToChapter(emptyPages, '/images/big.jpg', MAX_PAGE_IMAGE_SIZE_BYTES + 1, 'jpeg', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toContain('10 MB');
    });

    it('rejects zero-byte image size', () => {
      const result = addPageToChapter(emptyPages, '/images/empty.jpg', 0, 'jpeg', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toBeDefined();
    });

    it('rejects negative image size', () => {
      const result = addPageToChapter(emptyPages, '/images/neg.jpg', -100, 'jpeg', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toBeDefined();
    });

    it('rejects NaN image size', () => {
      const result = addPageToChapter(emptyPages, '/images/nan.jpg', NaN, 'jpeg', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toBeDefined();
    });

    it('rejects Infinity image size', () => {
      const result = addPageToChapter(emptyPages, '/images/inf.jpg', Infinity, 'jpeg', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(emptyPages);
      expect(result.error).toBeDefined();
    });

    it('preserves existing pages on invalid input', () => {
      const existingPages: ChapterPage[] = [
        {
          id: 'page-1',
          chapterId,
          imageUri: '/images/page1.jpg',
          imageSizeBytes: 500_000,
          imageFormat: 'jpeg',
          pageNumber: 1,
          createdAt: new Date(),
        },
      ];
      const result = addPageToChapter(existingPages, '/images/bad.gif', 500_000, 'gif', chapterId);
      expect(result.success).toBe(false);
      expect(result.pages).toBe(existingPages);
      expect(result.pages).toHaveLength(1);
      expect(result.error).toBeDefined();
    });
  });
});
