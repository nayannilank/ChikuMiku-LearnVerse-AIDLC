/**
 * Textbook and chapter content hierarchy models and validation.
 *
 * Defines the data models for the textbook → chapter → page hierarchy,
 * and a content name validator for textbook and chapter names.
 *
 * Requirements: 4.2, 4.6
 */

// --- Validation Response Type ---

export interface ContentNameValidationResponse {
  valid: boolean;
  error?: string;
}

// --- Content Name Validation ---

/** Minimum content name length (after trim) */
const CONTENT_NAME_MIN_LENGTH = 1;
/** Maximum content name length (after trim) */
const CONTENT_NAME_MAX_LENGTH = 200;

/**
 * Validates a content name (textbook or chapter name).
 *
 * Accepts the input if and only if the trimmed string has a length
 * between 1 and 200 characters inclusive.
 */
export function validateContentName(name: string): ContentNameValidationResponse {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Content name must be a string' };
  }

  const trimmed = name.trim();

  if (trimmed.length < CONTENT_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: 'Content name must not be empty after trimming whitespace',
    };
  }

  if (trimmed.length > CONTENT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Content name must not exceed ${CONTENT_NAME_MAX_LENGTH} characters after trimming`,
    };
  }

  return { valid: true };
}

// --- Content Hierarchy Interfaces ---

/**
 * Represents a textbook under a subject.
 * Subjects own textbooks; textbooks own chapters.
 */
export interface Textbook {
  id: string;                    // UUID
  subjectId: string;             // references enrolled subject
  learnerId: string;             // owner
  name: string;                  // 1-200 chars, non-empty after trim
  chapters: Chapter[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a chapter within a textbook.
 */
export interface Chapter {
  id: string;                    // UUID
  textbookId: string;            // references Textbook.id
  name: string;                  // 1-200 chars, non-empty after trim
  pages: Page[];
  chapterNumber: number;         // auto-incremented within textbook
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a page within a chapter.
 */
export interface Page {
  id: string;                    // UUID
  chapterId: string;             // references Chapter.id
  imageUri: string;              // stored image path/URL
  imageSizeBytes: number;        // max 10 MB (10_485_760 bytes)
  imageFormat: 'jpeg' | 'png';
  pageNumber: number;            // auto-incremented within chapter
  createdAt: Date;
}
