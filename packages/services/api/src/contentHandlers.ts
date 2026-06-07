/**
 * Content API Handlers — Textbook, Chapter, and Page management.
 *
 * Provides CRUD endpoints for the textbook → chapter → page hierarchy.
 * Each handler extracts the learner ID from the JWT (sub claim) and
 * uses in-memory stores following the project pattern.
 *
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.7, 4.9
 */

import { validateContentName } from '@learnverse/service-core';
import { addPageToChapter } from '@learnverse/service-core';
import type { Textbook, Chapter, Page } from '@learnverse/service-core/src/textbook';
import type { ChapterPage } from '@learnverse/service-core';
import type { ApiRequest, ApiResponse } from './endpoints';
import { randomUUID } from 'crypto';

// --- In-memory stores ---

/** Map of textbook ID → Textbook */
const textbookStore = new Map<string, Textbook>();

/** Map of chapter ID → Chapter (from textbook hierarchy) */
const chapterStore = new Map<string, Chapter>();

/**
 * Clears all content stores. Used in tests.
 */
export function clearContentStore(): void {
  textbookStore.clear();
  chapterStore.clear();
}

// --- Helper: Extract learner ID from JWT ---

function extractLearnerId(req: ApiRequest): string | null {
  const learnerId = req.headers['x-learner-id'];
  if (learnerId) return learnerId;

  const authHeader = req.headers['authorization'] ?? req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.sub ?? null;
  } catch {
    return token || null;
  }
}

// --- Helper: Extract path parameter ---

function extractPathParam(requestPath: string, routePattern: string, paramName: string): string | null {
  const routeParts = routePattern.split('/');
  const requestParts = requestPath.split('/');

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i] === `:${paramName}`) {
      return requestParts[i] ?? null;
    }
  }
  return null;
}

// --- Handlers ---

/**
 * GET /api/v1/subjects/:subjectId/textbooks
 *
 * Lists all textbooks for a given subject owned by the learner.
 */
export async function handleListTextbooks(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract subjectId from path: /api/v1/subjects/:subjectId/textbooks
  const pathParts = req.path.split('/');
  const subjectId = pathParts[4]; // /api/v1/subjects/<subjectId>/textbooks
  if (!subjectId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Subject ID is required.', retryable: false },
    };
  }

  const textbooks: Textbook[] = [];
  for (const tb of textbookStore.values()) {
    if (tb.subjectId === subjectId && tb.learnerId === learnerId) {
      textbooks.push(tb);
    }
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { data: textbooks },
  };
}

/**
 * POST /api/v1/subjects/:subjectId/textbooks
 *
 * Creates a new textbook under a subject.
 * Body: { "name": "English Grade 5" }
 */
export async function handleCreateTextbook(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract subjectId from path
  const pathParts = req.path.split('/');
  const subjectId = pathParts[4];
  if (!subjectId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Subject ID is required.', retryable: false },
    };
  }

  const body = req.body as { name?: string } | undefined;
  const nameValue = body?.name ?? '';

  // Validate content name
  const validation = validateContentName(nameValue);
  if (!validation.valid) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: validation.error!,
        field: 'name',
        submittedValues: { name: nameValue },
        retryable: false,
      },
    };
  }

  const now = new Date();
  const textbook: Textbook = {
    id: randomUUID(),
    subjectId,
    learnerId,
    name: nameValue.trim(),
    chapters: [],
    createdAt: now,
    updatedAt: now,
  };

  textbookStore.set(textbook.id, textbook);

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: { data: textbook, message: 'Textbook created successfully.' },
  };
}

/**
 * GET /api/v1/textbooks/:textbookId/chapters
 *
 * Lists all chapters for a given textbook.
 */
export async function handleListChapters(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract textbookId from path: /api/v1/textbooks/:textbookId/chapters
  const pathParts = req.path.split('/');
  const textbookId = pathParts[4]; // /api/v1/textbooks/<textbookId>/chapters
  if (!textbookId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Textbook ID is required.', retryable: false },
    };
  }

  const textbook = textbookStore.get(textbookId);
  if (!textbook || textbook.learnerId !== learnerId) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'TEXTBOOK_NOT_FOUND', message: 'Textbook not found.', retryable: false },
    };
  }

  // Gather chapters belonging to this textbook
  const chapters: Chapter[] = [];
  for (const ch of chapterStore.values()) {
    if (ch.textbookId === textbookId) {
      chapters.push(ch);
    }
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { data: chapters },
  };
}

/**
 * POST /api/v1/textbooks/:textbookId/chapters
 *
 * Creates a new chapter under a textbook.
 * Body: { "name": "Chapter 1: Introduction" }
 */
export async function handleCreateChapter(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract textbookId from path
  const pathParts = req.path.split('/');
  const textbookId = pathParts[4];
  if (!textbookId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Textbook ID is required.', retryable: false },
    };
  }

  const textbook = textbookStore.get(textbookId);
  if (!textbook || textbook.learnerId !== learnerId) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'TEXTBOOK_NOT_FOUND', message: 'Textbook not found.', retryable: false },
    };
  }

  const body = req.body as { name?: string } | undefined;
  const nameValue = body?.name ?? '';

  // Validate content name
  const validation = validateContentName(nameValue);
  if (!validation.valid) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: validation.error!,
        field: 'name',
        submittedValues: { name: nameValue },
        retryable: false,
      },
    };
  }

  // Auto-increment chapter number
  let maxChapterNumber = 0;
  for (const ch of chapterStore.values()) {
    if (ch.textbookId === textbookId && ch.chapterNumber > maxChapterNumber) {
      maxChapterNumber = ch.chapterNumber;
    }
  }

  const now = new Date();
  const chapter: Chapter = {
    id: randomUUID(),
    textbookId,
    name: nameValue.trim(),
    pages: [],
    chapterNumber: maxChapterNumber + 1,
    createdAt: now,
    updatedAt: now,
  };

  chapterStore.set(chapter.id, chapter);

  // Also add to the textbook's chapters array
  textbook.chapters.push(chapter);
  textbook.updatedAt = now;

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: { data: chapter, message: 'Chapter created successfully.' },
  };
}

/**
 * POST /api/v1/chapters/:chapterId/pages
 *
 * Uploads a page image to a chapter.
 * Body: { "imageUri": "...", "imageSizeBytes": 1024, "imageFormat": "jpeg" }
 */
export async function handleAddPage(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract chapterId from path: /api/v1/chapters/:chapterId/pages
  const pathParts = req.path.split('/');
  const chapterId = pathParts[4]; // /api/v1/chapters/<chapterId>/pages
  if (!chapterId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Chapter ID is required.', retryable: false },
    };
  }

  const chapter = chapterStore.get(chapterId);
  if (!chapter) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'CHAPTER_NOT_FOUND', message: 'Chapter not found.', retryable: false },
    };
  }

  const body = req.body as { imageUri?: string; imageSizeBytes?: number; imageFormat?: string } | undefined;
  const imageUri = body?.imageUri ?? '';
  const imageSizeBytes = body?.imageSizeBytes ?? 0;
  const imageFormat = body?.imageFormat ?? '';

  // Validate required fields
  if (!imageUri) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Image URI is required.',
        field: 'imageUri',
        submittedValues: { imageUri, imageSizeBytes, imageFormat },
        retryable: false,
      },
    };
  }

  // Use addPageToChapter for validation and page creation
  const currentPages: ChapterPage[] = chapter.pages.map((p) => ({
    id: p.id,
    chapterId: p.chapterId,
    imageUri: p.imageUri,
    imageSizeBytes: p.imageSizeBytes,
    imageFormat: p.imageFormat,
    pageNumber: p.pageNumber,
    createdAt: p.createdAt,
  }));

  const result = addPageToChapter(currentPages, imageUri, imageSizeBytes, imageFormat, chapterId);

  // If validation failed, return error with preserved submitted values
  if (!result.success) {
    // Determine which field caused the error
    const validFormats = ['jpeg', 'png'];
    const maxSize = 10_485_760;

    let errorField = 'imageFormat';

    if (!validFormats.includes(imageFormat)) {
      errorField = 'imageFormat';
    } else if (typeof imageSizeBytes !== 'number' || !Number.isFinite(imageSizeBytes) || imageSizeBytes <= 0) {
      errorField = 'imageSizeBytes';
    } else if (imageSizeBytes > maxSize) {
      errorField = 'imageSizeBytes';
    }

    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: result.error ?? 'Invalid image.',
        field: errorField,
        submittedValues: { imageUri, imageSizeBytes, imageFormat },
        retryable: false,
      },
    };
  }

  // Update the chapter's pages in the store
  const updatedPages = result.pages;
  const newPage = updatedPages[updatedPages.length - 1];
  const page: Page = {
    id: newPage.id,
    chapterId: newPage.chapterId,
    imageUri: newPage.imageUri,
    imageSizeBytes: newPage.imageSizeBytes,
    imageFormat: newPage.imageFormat,
    pageNumber: newPage.pageNumber,
    createdAt: newPage.createdAt,
  };

  chapter.pages.push(page);
  chapter.updatedAt = new Date();

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: { data: page, message: 'Page added successfully.' },
  };
}
