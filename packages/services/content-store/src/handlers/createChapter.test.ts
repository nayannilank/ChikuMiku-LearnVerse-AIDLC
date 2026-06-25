/**
 * Unit tests for createChapter handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCreateChapterHandler } from './createChapter';
import type { CreateChapterDbClient, CreatedChapterRecord } from './createChapter';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const VALID_BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_STUDENT_ID = '660e8400-e29b-41d4-a716-446655440000';

function createEvent(
  bookId?: string,
  body?: Record<string, unknown> | string | null,
  overrides?: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent {
  const bodyStr = body === null
    ? null
    : typeof body === 'string'
      ? body
      : JSON.stringify(body);
  return {
    body: bodyStr,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: bookId ? { id: bookId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: VALID_STUDENT_ID },
      },
    },
    httpMethod: 'POST',
    path: `/books/${bookId ?? ''}/chapters`,
    resource: '/books/{id}/chapters',
    ...overrides,
  };
}

function createMockDbClient(
  overrides?: Partial<CreateChapterDbClient>,
): CreateChapterDbClient {
  const defaultRecord: CreatedChapterRecord = {
    id: 'new-chapter-id',
    bookId: VALID_BOOK_ID,
    name: 'Test Chapter',
    sequenceNumber: 1,
    hasContent: false,
  };
  return {
    createChapter: vi.fn().mockResolvedValue(defaultRecord),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('createChapter handler', () => {
  it('returns 201 with created chapter on success', async () => {
    const created: CreatedChapterRecord = {
      id: 'ch-abc',
      bookId: VALID_BOOK_ID,
      name: 'Introduction',
      sequenceNumber: 2,
      hasContent: false,
    };
    const dbClient = createMockDbClient({
      createChapter: vi.fn().mockResolvedValue(created),
    });
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(
      createEvent(VALID_BOOK_ID, { name: 'Introduction' }),
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.chapter.name).toBe('Introduction');
    expect(body.chapter.sequenceNumber).toBe(2);
    expect(body.chapter.hasContent).toBe(false);
  });

  it('returns 401 when no auth claims present', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(
      createEvent(VALID_BOOK_ID, { name: 'Test' }, {
        requestContext: { authorizer: { claims: {} } },
      }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when book ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(createEvent('bad-id', { name: 'Test' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID, 'not-json{'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_BODY');
  });

  it('returns 400 when name is empty', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID, { name: '' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('1 and 200');
  });

  it('returns 400 when name is too long (>200 chars)', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const longName = 'A'.repeat(201);
    const result = await handler(
      createEvent(VALID_BOOK_ID, { name: longName }),
    );

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID, {}));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('trims whitespace from name before saving', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      id: 'id',
      bookId: VALID_BOOK_ID,
      name: 'Trimmed',
      sequenceNumber: 1,
      hasContent: false,
    });
    const dbClient = createMockDbClient({ createChapter: mockFn });
    const handler = createCreateChapterHandler(dbClient);

    await handler(createEvent(VALID_BOOK_ID, { name: '  Trimmed  ' }));

    expect(mockFn).toHaveBeenCalledWith(VALID_BOOK_ID, 'Trimmed');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      createChapter: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(
      createEvent(VALID_BOOK_ID, { name: 'Test' }),
    );

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateChapterHandler(dbClient);

    const result = await handler(
      createEvent(VALID_BOOK_ID, { name: 'Test' }),
    );

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
