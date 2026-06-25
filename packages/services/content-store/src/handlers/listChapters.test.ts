/**
 * Unit tests for listChapters handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createListChaptersHandler } from './listChapters';
import type { ListChaptersDbClient, ChapterRecord } from './listChapters';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const VALID_BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_STUDENT_ID = '660e8400-e29b-41d4-a716-446655440000';

function createEvent(
  bookId?: string,
  overrides?: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: bookId ? { id: bookId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: VALID_STUDENT_ID },
      },
    },
    httpMethod: 'GET',
    path: `/books/${bookId ?? ''}/chapters`,
    resource: '/books/{id}/chapters',
    ...overrides,
  };
}

function createMockDbClient(overrides?: Partial<ListChaptersDbClient>): ListChaptersDbClient {
  return {
    getChaptersForBook: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('listChapters handler', () => {
  it('returns 200 with chapters for a book', async () => {
    const chapters: ChapterRecord[] = [
      { id: 'c1', bookId: VALID_BOOK_ID, name: 'Introduction', sequenceNumber: 1, hasContent: true },
      { id: 'c2', bookId: VALID_BOOK_ID, name: 'Basics', sequenceNumber: 2, hasContent: false },
    ];
    const dbClient = createMockDbClient({
      getChaptersForBook: vi.fn().mockResolvedValue(chapters),
    });
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[0].name).toBe('Introduction');
    expect(body.chapters[0].hasContent).toBe(true);
    expect(body.chapters[1].hasContent).toBe(false);
  });

  it('returns 200 with empty array when no chapters exist', async () => {
    const dbClient = createMockDbClient();
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.chapters).toEqual([]);
  });

  it('returns 401 when no auth claims present', async () => {
    const dbClient = createMockDbClient();
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(
      createEvent(VALID_BOOK_ID, { requestContext: { authorizer: { claims: {} } } }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when book ID is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when book ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent('invalid-id'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getChaptersForBook: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createListChaptersHandler(dbClient);

    const result = await handler(createEvent(VALID_BOOK_ID));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });

  it('passes correct bookId to db client', async () => {
    const mockFn = vi.fn().mockResolvedValue([]);
    const dbClient = createMockDbClient({ getChaptersForBook: mockFn });
    const handler = createListChaptersHandler(dbClient);

    await handler(createEvent(VALID_BOOK_ID));

    expect(mockFn).toHaveBeenCalledWith(VALID_BOOK_ID);
  });
});
