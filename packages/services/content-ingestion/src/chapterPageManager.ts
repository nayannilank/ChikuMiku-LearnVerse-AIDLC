/**
 * Chapter page management.
 *
 * Handles:
 * - Combining pages in sequential order (max 50 per chapter)
 * - Appending new pages to existing chapters
 * - Reordering pages within a chapter
 * - Rejecting pages beyond the 50-page limit
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import { Chapter, Page, MAX_PAGES_PER_CHAPTER } from '@chikumiku/service-core';

// --- Types ---

export interface AddPageInput {
  id: string;
  originalImageUrl: string;
  compressedImageUrl: string;
  extractedText: string;
  confidence: number;
  partialRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface PageOperationSuccess<T = Chapter> {
  success: true;
  chapter: T;
}

export interface PageOperationError {
  success: false;
  error: string;
  code: 'PAGE_LIMIT_EXCEEDED' | 'INVALID_PAGE_ORDER' | 'PAGE_NOT_FOUND' | 'INVALID_CHAPTER';
}

export type PageOperationResult<T = Chapter> = PageOperationSuccess<T> | PageOperationError;

// --- Page Management Functions ---

/**
 * Creates a new chapter with the given pages.
 * Pages are assigned sequential order indices starting from 0.
 * Rejects if more than 50 pages are provided.
 */
export function createChapterWithPages(
  chapterBase: Omit<Chapter, 'pages' | 'extractedText'>,
  pages: AddPageInput[]
): PageOperationResult {
  if (pages.length > MAX_PAGES_PER_CHAPTER) {
    return {
      success: false,
      error: `Cannot add ${pages.length} pages. Maximum is ${MAX_PAGES_PER_CHAPTER} pages per chapter.`,
      code: 'PAGE_LIMIT_EXCEEDED',
    };
  }

  const orderedPages: Page[] = pages.map((page, index) => ({
    ...page,
    orderIndex: index,
  }));

  const extractedText = orderedPages.map((p) => p.extractedText).join('\n\n');

  const chapter: Chapter = {
    ...chapterBase,
    pages: orderedPages,
    extractedText,
  };

  return { success: true, chapter };
}

/**
 * Appends new pages to an existing chapter.
 * New pages are added at the end, after existing pages.
 * Rejects if total page count would exceed 50.
 */
export function appendPages(chapter: Chapter, newPages: AddPageInput[]): PageOperationResult {
  const totalAfterAppend = chapter.pages.length + newPages.length;

  if (totalAfterAppend > MAX_PAGES_PER_CHAPTER) {
    const remaining = MAX_PAGES_PER_CHAPTER - chapter.pages.length;
    return {
      success: false,
      error: `Cannot add ${newPages.length} pages. Chapter already has ${chapter.pages.length} pages. Maximum is ${MAX_PAGES_PER_CHAPTER} pages per chapter (${remaining} remaining).`,
      code: 'PAGE_LIMIT_EXCEEDED',
    };
  }

  const startIndex = chapter.pages.length;
  const appendedPages: Page[] = newPages.map((page, index) => ({
    ...page,
    orderIndex: startIndex + index,
  }));

  const updatedPages = [...chapter.pages, ...appendedPages];
  const extractedText = updatedPages.map((p) => p.extractedText).join('\n\n');

  const updatedChapter: Chapter = {
    ...chapter,
    pages: updatedPages,
    extractedText,
    updatedAt: new Date(),
  };

  return { success: true, chapter: updatedChapter };
}

/**
 * Reorders pages within a chapter according to the provided page ID order.
 * All existing page IDs must be present in the new order (no additions or removals).
 * Pages are reassigned sequential order indices based on the new order.
 */
export function reorderPages(chapter: Chapter, newPageOrder: string[]): PageOperationResult {
  // Validate that the new order contains exactly the same page IDs
  const existingIds = new Set(chapter.pages.map((p) => p.id));
  const newOrderIds = new Set(newPageOrder);

  if (newPageOrder.length !== chapter.pages.length) {
    return {
      success: false,
      error: `Page order must contain exactly ${chapter.pages.length} page IDs. Received ${newPageOrder.length}.`,
      code: 'INVALID_PAGE_ORDER',
    };
  }

  // Check for missing pages
  for (const id of existingIds) {
    if (!newOrderIds.has(id)) {
      return {
        success: false,
        error: `Page "${id}" exists in the chapter but is missing from the new order.`,
        code: 'INVALID_PAGE_ORDER',
      };
    }
  }

  // Check for unknown pages
  for (const id of newPageOrder) {
    if (!existingIds.has(id)) {
      return {
        success: false,
        error: `Page "${id}" is not found in this chapter.`,
        code: 'PAGE_NOT_FOUND',
      };
    }
  }

  // Build a lookup map for pages
  const pageMap = new Map(chapter.pages.map((p) => [p.id, p]));

  // Reorder pages according to the new order
  const reorderedPages: Page[] = newPageOrder.map((id, index) => ({
    ...pageMap.get(id)!,
    orderIndex: index,
  }));

  const extractedText = reorderedPages.map((p) => p.extractedText).join('\n\n');

  const updatedChapter: Chapter = {
    ...chapter,
    pages: reorderedPages,
    extractedText,
    updatedAt: new Date(),
  };

  return { success: true, chapter: updatedChapter };
}

/**
 * Returns the number of pages that can still be added to a chapter.
 */
export function getRemainingPageCapacity(chapter: Chapter): number {
  return MAX_PAGES_PER_CHAPTER - chapter.pages.length;
}

/**
 * Checks if a chapter has reached its page limit.
 */
export function isAtPageLimit(chapter: Chapter): boolean {
  return chapter.pages.length >= MAX_PAGES_PER_CHAPTER;
}
