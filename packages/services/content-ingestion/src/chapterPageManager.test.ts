import { describe, it, expect } from 'vitest';
import {
  createChapterWithPages,
  appendPages,
  reorderPages,
  getRemainingPageCapacity,
  isAtPageLimit,
  AddPageInput,
} from './chapterPageManager';
import { Chapter, MAX_PAGES_PER_CHAPTER } from '@chikumiku/service-core';

function makePageInput(id: string, text: string = `Text for ${id}`): AddPageInput {
  return {
    id,
    originalImageUrl: `https://storage.example.com/original/${id}.jpg`,
    compressedImageUrl: `https://storage.example.com/compressed/${id}.jpg`,
    extractedText: text,
    confidence: 0.95,
  };
}

function makeChapterBase() {
  return {
    id: 'chapter-1',
    learnerId: 'learner-1',
    subjectId: 'kannada',
    textbookName: 'Kannada Textbook Grade 5',
    chapterNumber: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-01'),
  };
}

function makeChapter(pageCount: number): Chapter {
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    id: `page-${i}`,
    orderIndex: i,
    originalImageUrl: `https://storage.example.com/original/page-${i}.jpg`,
    compressedImageUrl: `https://storage.example.com/compressed/page-${i}.jpg`,
    extractedText: `Text for page ${i}`,
    confidence: 0.95,
  }));

  return {
    ...makeChapterBase(),
    pages,
    extractedText: pages.map((p) => p.extractedText).join('\n\n'),
  };
}

describe('chapterPageManager', () => {
  describe('createChapterWithPages', () => {
    it('creates a chapter with pages in sequential order', () => {
      const pages = [makePageInput('p1', 'Hello'), makePageInput('p2', 'World')];
      const result = createChapterWithPages(makeChapterBase(), pages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages).toHaveLength(2);
        expect(result.chapter.pages[0].orderIndex).toBe(0);
        expect(result.chapter.pages[1].orderIndex).toBe(1);
        expect(result.chapter.pages[0].id).toBe('p1');
        expect(result.chapter.pages[1].id).toBe('p2');
        expect(result.chapter.extractedText).toBe('Hello\n\nWorld');
      }
    });

    it('accepts exactly 50 pages', () => {
      const pages = Array.from({ length: 50 }, (_, i) => makePageInput(`p${i}`));
      const result = createChapterWithPages(makeChapterBase(), pages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages).toHaveLength(50);
      }
    });

    it('rejects more than 50 pages', () => {
      const pages = Array.from({ length: 51 }, (_, i) => makePageInput(`p${i}`));
      const result = createChapterWithPages(makeChapterBase(), pages);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('PAGE_LIMIT_EXCEEDED');
        expect(result.error).toContain('51');
        expect(result.error).toContain('50');
      }
    });

    it('creates a chapter with zero pages', () => {
      const result = createChapterWithPages(makeChapterBase(), []);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages).toHaveLength(0);
        expect(result.chapter.extractedText).toBe('');
      }
    });
  });

  describe('appendPages', () => {
    it('appends pages to an existing chapter', () => {
      const chapter = makeChapter(3);
      const newPages = [makePageInput('new-1', 'New page 1'), makePageInput('new-2', 'New page 2')];

      const result = appendPages(chapter, newPages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages).toHaveLength(5);
        expect(result.chapter.pages[3].id).toBe('new-1');
        expect(result.chapter.pages[3].orderIndex).toBe(3);
        expect(result.chapter.pages[4].id).toBe('new-2');
        expect(result.chapter.pages[4].orderIndex).toBe(4);
      }
    });

    it('preserves existing pages when appending', () => {
      const chapter = makeChapter(2);
      const newPages = [makePageInput('new-1')];

      const result = appendPages(chapter, newPages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages[0].id).toBe('page-0');
        expect(result.chapter.pages[1].id).toBe('page-1');
        expect(result.chapter.pages[2].id).toBe('new-1');
      }
    });

    it('rejects if total would exceed 50 pages', () => {
      const chapter = makeChapter(48);
      const newPages = [makePageInput('new-1'), makePageInput('new-2'), makePageInput('new-3')];

      const result = appendPages(chapter, newPages);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('PAGE_LIMIT_EXCEEDED');
        expect(result.error).toContain('3');
        expect(result.error).toContain('48');
      }
    });

    it('allows appending up to the limit', () => {
      const chapter = makeChapter(48);
      const newPages = [makePageInput('new-1'), makePageInput('new-2')];

      const result = appendPages(chapter, newPages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages).toHaveLength(50);
      }
    });

    it('updates the extractedText to include new pages', () => {
      const chapter = makeChapter(1);
      const newPages = [makePageInput('new-1', 'Appended text')];

      const result = appendPages(chapter, newPages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.extractedText).toContain('Appended text');
      }
    });
  });

  describe('reorderPages', () => {
    it('reorders pages according to new order', () => {
      const chapter = makeChapter(3);
      const newOrder = ['page-2', 'page-0', 'page-1'];

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages[0].id).toBe('page-2');
        expect(result.chapter.pages[0].orderIndex).toBe(0);
        expect(result.chapter.pages[1].id).toBe('page-0');
        expect(result.chapter.pages[1].orderIndex).toBe(1);
        expect(result.chapter.pages[2].id).toBe('page-1');
        expect(result.chapter.pages[2].orderIndex).toBe(2);
      }
    });

    it('preserves all page content after reorder', () => {
      const chapter = makeChapter(3);
      const originalTexts = chapter.pages.map((p) => p.extractedText);
      const newOrder = ['page-2', 'page-0', 'page-1'];

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        const reorderedTexts = result.chapter.pages.map((p) => p.extractedText);
        expect(reorderedTexts.sort()).toEqual(originalTexts.sort());
      }
    });

    it('rejects if page count does not match', () => {
      const chapter = makeChapter(3);
      const newOrder = ['page-0', 'page-1']; // missing page-2

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_PAGE_ORDER');
      }
    });

    it('rejects if unknown page ID is provided', () => {
      const chapter = makeChapter(3);
      const newOrder = ['page-0', 'page-1', 'unknown-page'];

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(false);
      if (!result.success) {
        // page-2 is missing from the new order, so INVALID_PAGE_ORDER fires first
        expect(result.code).toBe('INVALID_PAGE_ORDER');
      }
    });

    it('rejects if a page is missing from the new order', () => {
      const chapter = makeChapter(3);
      const newOrder = ['page-0', 'page-1', 'page-0']; // duplicate, missing page-2

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(false);
    });

    it('handles identity reorder (same order)', () => {
      const chapter = makeChapter(3);
      const newOrder = ['page-0', 'page-1', 'page-2'];

      const result = reorderPages(chapter, newOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.chapter.pages[0].id).toBe('page-0');
        expect(result.chapter.pages[1].id).toBe('page-1');
        expect(result.chapter.pages[2].id).toBe('page-2');
      }
    });
  });

  describe('getRemainingPageCapacity', () => {
    it('returns 50 for empty chapter', () => {
      const chapter = makeChapter(0);
      expect(getRemainingPageCapacity(chapter)).toBe(50);
    });

    it('returns 0 for full chapter', () => {
      const chapter = makeChapter(50);
      expect(getRemainingPageCapacity(chapter)).toBe(0);
    });

    it('returns correct remaining for partially filled chapter', () => {
      const chapter = makeChapter(30);
      expect(getRemainingPageCapacity(chapter)).toBe(20);
    });
  });

  describe('isAtPageLimit', () => {
    it('returns false for empty chapter', () => {
      expect(isAtPageLimit(makeChapter(0))).toBe(false);
    });

    it('returns true for chapter with 50 pages', () => {
      expect(isAtPageLimit(makeChapter(50))).toBe(true);
    });

    it('returns false for chapter with 49 pages', () => {
      expect(isAtPageLimit(makeChapter(49))).toBe(false);
    });
  });
});
