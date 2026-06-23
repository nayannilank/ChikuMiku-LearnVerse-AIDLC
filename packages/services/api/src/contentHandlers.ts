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

/** Map of chapter ID → subjectId (tracks subject association for standalone chapters) */
const chapterSubjectMap = new Map<string, string>();

/**
 * Clears all content stores. Used in tests.
 */
export function clearContentStore(): void {
  textbookStore.clear();
  chapterStore.clear();
  chapterSubjectMap.clear();
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

/**
 * POST /api/v1/chapters
 *
 * Creates a standalone chapter (not scoped to a textbook route).
 * Body: { "name": "...", "textbookId": "...", "subjectId": "..." }
 *
 * Requirements: 8.1, 8.2, 8.3
 */
export async function handleCreateStandaloneChapter(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as { name?: string; textbookId?: string; subjectId?: string } | undefined;
  const nameValue = body?.name ?? '';
  const textbookId = body?.textbookId ?? '';
  const subjectId = body?.subjectId ?? '';

  // Validate required fields
  const errors: Array<{ field: string; message: string }> = [];

  const trimmedName = nameValue.trim();
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 200) {
    errors.push({
      field: 'name',
      message: 'Name is required and must be between 1 and 200 characters.',
    });
  }

  if (!textbookId) {
    errors.push({
      field: 'textbookId',
      message: 'Textbook ID is required.',
    });
  }

  if (!subjectId) {
    errors.push({
      field: 'subjectId',
      message: 'Subject ID is required.',
    });
  }

  if (errors.length > 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        errors,
        retryable: false,
      },
    };
  }

  const now = new Date();
  const chapter: Chapter = {
    id: randomUUID(),
    textbookId,
    name: trimmedName,
    pages: [],
    chapterNumber: 1,
    createdAt: now,
    updatedAt: now,
  };

  chapterStore.set(chapter.id, chapter);
  chapterSubjectMap.set(chapter.id, subjectId);

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: { id: chapter.id, message: 'Chapter created' },
  };
}

/**
 * GET /api/v1/chapters/:chapterId
 *
 * Retrieves a chapter by its ID.
 *
 * Requirements: 9.1, 9.2, 9.3
 */
export async function handleGetChapterById(req: ApiRequest): Promise<ApiResponse> {
  // Extract chapterId from path: /api/v1/chapters/:chapterId
  const pathParts = req.path.split('/');
  const chapterId = pathParts[4]; // /api/v1/chapters/<chapterId>

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
      body: { code: 'NOT_FOUND', message: 'Chapter not found', retryable: false },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      name: chapter.name,
      pageCount: chapter.pages.length,
      createdAt: chapter.createdAt,
      textbookId: chapter.textbookId,
    },
  };
}

/**
 * GET /api/v1/subjects/:subjectId/chapters
 *
 * Lists chapters for a subject with pagination.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export async function handleListSubjectChapters(req: ApiRequest): Promise<ApiResponse> {
  // Extract subjectId from path: /api/v1/subjects/:subjectId/chapters
  const pathParts = req.path.split('/');
  const subjectId = pathParts[4]; // /api/v1/subjects/<subjectId>/chapters

  if (!subjectId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Subject ID is required.', retryable: false },
    };
  }

  // Parse pagination params
  const pageParam = req.queryParams?.page;
  const pageSizeParam = req.queryParams?.pageSize;
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const pageSize = pageSizeParam ? Math.max(1, parseInt(pageSizeParam, 10) || 20) : 20;

  // Filter chapters by subjectId
  const subjectChapters: Chapter[] = [];
  for (const [chapterId, chapter] of chapterStore.entries()) {
    const mappedSubjectId = chapterSubjectMap.get(chapterId);
    if (mappedSubjectId === subjectId) {
      subjectChapters.push(chapter);
    }
  }

  const totalItems = subjectChapters.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  // Slice for pagination
  const startIndex = (page - 1) * pageSize;
  const paginatedData = subjectChapters.slice(startIndex, startIndex + pageSize);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    },
  };
}
