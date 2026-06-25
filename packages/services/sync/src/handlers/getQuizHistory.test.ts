/**
 * Unit tests for getQuizHistory handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createGetQuizHistoryHandler, isValidISODate } from './getQuizHistory';
import type { QuizHistoryDbClient, QuizHistorySession } from './getQuizHistory';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(
  studentId: string | undefined,
  queryParams?: Record<string, string | undefined>,
  authenticated = true,
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: studentId ? { studentId } : null,
    queryStringParameters: queryParams || null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'auth-user-id' } }
        : undefined,
    },
    httpMethod: 'GET',
    path: `/progress/${studentId ?? ''}/quiz-history`,
    resource: '/progress/{studentId}/quiz-history',
  };
}

function createMockDbClient(overrides?: Partial<QuizHistoryDbClient>): QuizHistoryDbClient {
  return {
    getQuizHistory: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
    ...overrides,
  };
}

function createMockSession(overrides?: Partial<QuizHistorySession>): QuizHistorySession {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    subjectId: '770e8400-e29b-41d4-a716-446655440002',
    totalQuestions: 20,
    correctAnswers: 15,
    scorePercentage: 75.0,
    startedAt: '2024-01-15T10:00:00.000Z',
    endedAt: '2024-01-15T10:15:00.000Z',
    status: 'completed',
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

const validStudentId = '550e8400-e29b-41d4-a716-446655440000';

describe('getQuizHistory handler', () => {
  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, undefined, false));

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  describe('parameter validation', () => {
    it('returns 400 when studentId is missing', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(undefined));

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('studentId');
    });

    it('returns 400 when studentId is not a valid UUID', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent('not-a-uuid'));

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('studentId');
    });

    it('returns 400 when startDate is invalid', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, { startDate: 'not-a-date' }));

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('startDate');
    });

    it('returns 400 when endDate is invalid', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, { endDate: 'invalid' }));

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('endDate');
    });

    it('returns 400 when subjectId is not a valid UUID', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, { subjectId: 'bad-uuid' }));

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('subjectId');
    });
  });

  describe('successful responses', () => {
    it('returns 200 with empty sessions when no history exists', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId));

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.studentId).toBe(validStudentId);
      expect(body.sessions).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
      expect(body.hasMore).toBe(false);
    });

    it('returns 200 with quiz history sessions', async () => {
      const sessions = [createMockSession(), createMockSession({ id: '880e8400-e29b-41d4-a716-446655440003' })];
      const dbClient = createMockDbClient({
        getQuizHistory: vi.fn().mockResolvedValue({ sessions, total: 2 }),
      });
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId));

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.sessions).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.sessions[0].subjectId).toBe('770e8400-e29b-41d4-a716-446655440002');
      expect(body.sessions[0].scorePercentage).toBe(75.0);
    });

    it('passes date range filters to database client', async () => {
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId, {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      }));

      expect(getQuizHistory).toHaveBeenCalledWith({
        studentId: validStudentId,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        subjectId: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('passes subjectId filter to database client', async () => {
      const subjectId = '990e8400-e29b-41d4-a716-446655440004';
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId, { subjectId }));

      expect(getQuizHistory).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId }),
      );
    });
  });

  describe('pagination', () => {
    it('uses default pagination when no params provided', async () => {
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId));

      expect(getQuizHistory).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });

    it('accepts custom page and pageSize', async () => {
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId, { page: '3', pageSize: '10' }));

      expect(getQuizHistory).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, pageSize: 10 }),
      );
    });

    it('caps pageSize at 100', async () => {
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId, { pageSize: '500' }));

      expect(getQuizHistory).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 100 }),
      );
    });

    it('sets hasMore to true when more results exist', async () => {
      const dbClient = createMockDbClient({
        getQuizHistory: vi.fn().mockResolvedValue({ sessions: [createMockSession()], total: 45 }),
      });
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, { page: '1', pageSize: '20' }));

      const body = JSON.parse(result.body);
      expect(body.hasMore).toBe(true);
      expect(body.total).toBe(45);
    });

    it('sets hasMore to false when on last page', async () => {
      const dbClient = createMockDbClient({
        getQuizHistory: vi.fn().mockResolvedValue({ sessions: [createMockSession()], total: 5 }),
      });
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId, { page: '1', pageSize: '20' }));

      const body = JSON.parse(result.body);
      expect(body.hasMore).toBe(false);
    });

    it('enforces minimum page of 1', async () => {
      const getQuizHistory = vi.fn().mockResolvedValue({ sessions: [], total: 0 });
      const dbClient = createMockDbClient({ getQuizHistory });
      const handler = createGetQuizHistoryHandler(dbClient);

      await handler(createEvent(validStudentId, { page: '0' }));

      expect(getQuizHistory).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  describe('error handling', () => {
    it('returns 500 when database throws', async () => {
      const dbClient = createMockDbClient({
        getQuizHistory: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId));

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('CORS headers', () => {
    it('includes CORS headers in all responses', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetQuizHistoryHandler(dbClient);

      const result = await handler(createEvent(validStudentId));

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });
});

describe('isValidISODate', () => {
  it('accepts full ISO 8601 date-time with Z suffix', () => {
    expect(isValidISODate('2024-01-15T10:30:00Z')).toBe(true);
  });

  it('accepts full ISO 8601 date-time with timezone offset', () => {
    expect(isValidISODate('2024-01-15T10:30:00+05:30')).toBe(true);
  });

  it('accepts date-only format', () => {
    expect(isValidISODate('2024-01-15')).toBe(true);
  });

  it('accepts date-time with milliseconds', () => {
    expect(isValidISODate('2024-01-15T10:30:00.123Z')).toBe(true);
  });

  it('rejects invalid date strings', () => {
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidISODate('')).toBe(false);
  });

  it('rejects partial dates', () => {
    expect(isValidISODate('2024-13-45')).toBe(false);
  });

  it('rejects non-ISO formatted dates', () => {
    expect(isValidISODate('01/15/2024')).toBe(false);
  });
});
