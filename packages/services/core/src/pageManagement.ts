/**
 * Page management module for LearnVerse LearnVerse.
 *
 * Provides functions to manage pages within chapters, including
 * validation of image format and size constraints.
 *
 * Requirements: 5.5, 5.11, 5.12, 5.14
 */

import { randomUUID } from 'crypto';
import type { Page } from './textbook';

// --- Page-specific types for chapter management ---

/** Supported image formats for page images (JPEG and PNG only) */
export type PageImageFormat = 'jpeg' | 'png';

/** Maximum page image size in bytes (10 MB) */
export const MAX_PAGE_IMAGE_SIZE_BYTES = 10_485_760;

/** Valid image formats for pages */
const VALID_PAGE_IMAGE_FORMATS: readonly PageImageFormat[] = ['jpeg', 'png'];

/**
 * A page within a chapter, representing a captured or uploaded textbook page image.
 */
export interface ChapterPage {
  id: string;
  chapterId: string;
  imageUri: string;
  imageSizeBytes: number;
  imageFormat: PageImageFormat;
  pageNumber: number;
  createdAt: Date;
}

/**
 * Result of the addPageToChapter operation.
 * Includes both the result pages array and a success/error indicator.
 */
export interface AddPageResult {
  /** Whether the page was successfully added */
  success: boolean;
  /** The resulting pages array (updated on success, unchanged on failure) */
  pages: ChapterPage[];
  /** Error message when validation fails */
  error?: string;
}

/**
 * Adds a new page to a chapter's page array after validating the image.
 *
 * Validation rules:
 * - Image format must be 'jpeg' or 'png'
 * - Image size must be ≤ 10 MB (10,485,760 bytes)
 *
 * @param pages - The current array of pages in the chapter
 * @param imageUri - The stored image path/URL
 * @param imageSizeBytes - The size of the image in bytes
 * @param imageFormat - The format of the image ('jpeg' or 'png')
 * @param chapterId - The ID of the chapter this page belongs to
 * @returns An AddPageResult containing success status, the pages array, and optional error message
 */
export function addPageToChapter(
  pages: ChapterPage[],
  imageUri: string,
  imageSizeBytes: number,
  imageFormat: string,
  chapterId: string = ''
): AddPageResult {
  // Validate image format
  if (!VALID_PAGE_IMAGE_FORMATS.includes(imageFormat as PageImageFormat)) {
    return {
      success: false,
      pages,
      error: `Invalid image format '${imageFormat}'. Accepted formats: jpeg, png`,
    };
  }

  // Validate image size is a finite positive number
  if (typeof imageSizeBytes !== 'number' || !Number.isFinite(imageSizeBytes)) {
    return {
      success: false,
      pages,
      error: 'Image size must be a valid positive number',
    };
  }

  if (imageSizeBytes <= 0) {
    return {
      success: false,
      pages,
      error: 'Image size must be greater than zero',
    };
  }

  // Validate image size does not exceed 10 MB
  if (imageSizeBytes > MAX_PAGE_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      pages,
      error: `File exceeds 10 MB limit (${imageSizeBytes} bytes)`,
    };
  }

  // Auto-increment page number based on existing pages
  const nextPageNumber = pages.length > 0
    ? Math.max(...pages.map(p => p.pageNumber)) + 1
    : 1;

  const newPage: ChapterPage = {
    id: randomUUID(),
    chapterId,
    imageUri,
    imageSizeBytes,
    imageFormat: imageFormat as PageImageFormat,
    pageNumber: nextPageNumber,
    createdAt: new Date(),
  };

  return {
    success: true,
    pages: [...pages, newPage],
  };
}
