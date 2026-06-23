/**
 * Property Tests: Content Handlers — Standalone Chapter CRUD & Listing
 *
 * Feature: backend-stub-implementations
 * - Property 19: Chapter creation and retrieval round-trip
 * - Property 20: Chapter creation rejects invalid input
 * - Property 21: Non-existent chapter returns 404
 * - Property 22: Subject chapters are filtered correctly with pagination
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 10.1, 10.3**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  handleCreateStandaloneChapter,
  handleGetChapterById,
  handleListSubjectChapters,
  clearContentStore,
} from '../contentHandlers';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid chapter name: 1-200 chars, non-empty after trim */
const validNameArb = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'.split(''),
    ),
    { minLength: 1, maxLength: 100 },
  )
  .filter((n) => n.trim().length >= 1 && n.trim().length <= 200);

/** Valid UUID-like ID (simulates textbookId and subjectId) */
const validIdArb = fc.uuid();

// ─── Helper: Build ApiRequest objects ─────────────────────────────────────────

function makeCreateChapterRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/chapters',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

function makeGetChapterRequest(chapterId: string) {
  return {
    method: 'GET' as const,
    path: `/api/v1/chapters/${chapterId}`,
    headers: { 'Content-Type': 'application/json' },
  };
}

function makeListSubjectChaptersRequest(
  subjectId: string,
  page?: number,
  pageSize?: number,
) {
  const queryParams: Record<string, string> = {};
  if (page !== undefined) queryParams.page = String(page);
  if (pageSize !== undefined) queryParams.pageSize = String(pageSize);

  return {
    method: 'GET' as const,
    path: `/api/v1/subjects/${subjectId}/chapters`,
    headers: { 'Content-Type': 'application/json' },
    queryParams,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Feature: backend-stub-implementations, Property 19: Chapter creation and retrieval round-trip
describe('Property 19: Chapter creation and retrieval round-trip', () => {
  beforeEach(() => {
    clearContentStore();
  });

  it('for any valid chapter creation payload, creating and then retrieving by ID returns the same name and textbookId', async () => {
    await fc.assert(
      fc.asyncProperty(
        validNameArb,
        validIdArb,
        validIdArb,
        async (name, textbookId, subjectId) => {
          // Create a chapter
          const createRes = await handleCreateStandaloneChapter(
            makeCreateChapterRequest({ name, textbookId, subjectId }),
          );

          expect(createRes.status).toBe(201);
          const createBody = createRes.body as { id: string; message: string };
          expect(createBody.id).toBeDefined();
          expect(createBody.message).toBe('Chapter created');

          // Retrieve the chapter
          const getRes = await handleGetChapterById(
            makeGetChapterRequest(createBody.id),
          );

          expect(getRes.status).toBe(200);
          const getBody = getRes.body as {
            name: string;
            pageCount: number;
            createdAt: Date;
            textbookId: string;
          };
          expect(getBody.name).toBe(name.trim());
          expect(getBody.textbookId).toBe(textbookId);
          expect(getBody.pageCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 20: Chapter creation rejects invalid input
describe('Property 20: Chapter creation rejects invalid input', () => {
  beforeEach(() => {
    clearContentStore();
  });

  it('missing name field returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(validIdArb, validIdArb, async (textbookId, subjectId) => {
        // Missing name entirely
        const res = await handleCreateStandaloneChapter(
          makeCreateChapterRequest({ textbookId, subjectId }),
        );

        expect(res.status).toBe(400);
        const body = res.body as {
          code: string;
          message: string;
          errors: Array<{ field: string; message: string }>;
          retryable: boolean;
        };
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toBe('Validation failed.');
        expect(body.retryable).toBe(false);
        expect(body.errors.some((e) => e.field === 'name')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('missing textbookId field returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(validNameArb, validIdArb, async (name, subjectId) => {
        const res = await handleCreateStandaloneChapter(
          makeCreateChapterRequest({ name, subjectId }),
        );

        expect(res.status).toBe(400);
        const body = res.body as {
          code: string;
          errors: Array<{ field: string; message: string }>;
        };
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.errors.some((e) => e.field === 'textbookId')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('missing subjectId field returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(validNameArb, validIdArb, async (name, textbookId) => {
        const res = await handleCreateStandaloneChapter(
          makeCreateChapterRequest({ name, textbookId }),
        );

        expect(res.status).toBe(400);
        const body = res.body as {
          code: string;
          errors: Array<{ field: string; message: string }>;
        };
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.errors.some((e) => e.field === 'subjectId')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('empty name (or whitespace-only) returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', '   ', '\t\n'),
        validIdArb,
        validIdArb,
        async (name, textbookId, subjectId) => {
          const res = await handleCreateStandaloneChapter(
            makeCreateChapterRequest({ name, textbookId, subjectId }),
          );

          expect(res.status).toBe(400);
          const body = res.body as {
            code: string;
            errors: Array<{ field: string; message: string }>;
          };
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.errors.some((e) => e.field === 'name')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 21: Non-existent chapter returns 404
describe('Property 21: Non-existent chapter returns 404', () => {
  beforeEach(() => {
    clearContentStore();
  });

  it('for any chapter ID that has not been created, GET returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(validIdArb, async (chapterId) => {
        const res = await handleGetChapterById(makeGetChapterRequest(chapterId));

        expect(res.status).toBe(404);
        const body = res.body as { code: string; message: string; retryable: boolean };
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toBe('Chapter not found');
        expect(body.retryable).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 22: Subject chapters are filtered correctly with pagination
describe('Property 22: Subject chapters are filtered correctly with pagination', () => {
  beforeEach(() => {
    clearContentStore();
  });

  it('querying by subjectId returns only chapters belonging to that subject with correct pagination', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2 distinct subject IDs
        validIdArb,
        validIdArb,
        // Number of chapters for subject A (1-5)
        fc.integer({ min: 1, max: 5 }),
        // Number of chapters for subject B (1-5)
        fc.integer({ min: 1, max: 5 }),
        // Page size (1-3 to make pagination testable)
        fc.integer({ min: 1, max: 3 }),
        validIdArb, // textbookId
        async (subjectA, subjectB, countA, countB, pageSize, textbookId) => {
          // Ensure distinct subject IDs
          if (subjectA === subjectB) return;

          // Create chapters for subject A
          const chapterIdsA: string[] = [];
          for (let i = 0; i < countA; i++) {
            const res = await handleCreateStandaloneChapter(
              makeCreateChapterRequest({
                name: `SubjectA Chapter ${i}`,
                textbookId,
                subjectId: subjectA,
              }),
            );
            expect(res.status).toBe(201);
            chapterIdsA.push((res.body as { id: string }).id);
          }

          // Create chapters for subject B
          for (let i = 0; i < countB; i++) {
            const res = await handleCreateStandaloneChapter(
              makeCreateChapterRequest({
                name: `SubjectB Chapter ${i}`,
                textbookId,
                subjectId: subjectB,
              }),
            );
            expect(res.status).toBe(201);
          }

          // Query subject A chapters - page 1
          const listRes = await handleListSubjectChapters(
            makeListSubjectChaptersRequest(subjectA, 1, pageSize),
          );

          expect(listRes.status).toBe(200);
          const listBody = listRes.body as {
            data: Array<{ id: string; name: string }>;
            pagination: {
              page: number;
              pageSize: number;
              totalItems: number;
              totalPages: number;
            };
          };

          // Verify filtering: totalItems matches exactly the count for subject A
          expect(listBody.pagination.totalItems).toBe(countA);
          expect(listBody.pagination.page).toBe(1);
          expect(listBody.pagination.pageSize).toBe(pageSize);
          expect(listBody.pagination.totalPages).toBe(Math.ceil(countA / pageSize));

          // Verify page slice size
          const expectedPageItems = Math.min(pageSize, countA);
          expect(listBody.data.length).toBe(expectedPageItems);

          // Verify all returned chapters belong to subject A
          for (const chapter of listBody.data) {
            expect(chapterIdsA).toContain(chapter.id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
