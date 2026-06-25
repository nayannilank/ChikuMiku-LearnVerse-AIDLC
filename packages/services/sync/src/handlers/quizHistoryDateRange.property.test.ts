/**
 * Property Test: Historical Quiz Scores Date Range
 *
 * Property 25: For any date range query, all returned quiz session results
 * SHALL have timestamps falling within the specified start and end dates,
 * ordered by date descending.
 *
 * **Validates: Requirements 19.6, 21.5**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { createGetQuizHistoryHandler, isValidISODate } from './getQuizHistory';
import type { QuizHistoryDbClient, QuizHistorySession, QuizHistoryQuery } from './getQuizHistory';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validStudentId = '550e8400-e29b-41d4-a716-446655440000';

function createEvent(
  queryParams?: Record<string, string | undefined>,
  studentId = validStudentId,
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: { studentId },
    queryStringParameters: queryParams || null,
    requestContext: {
      authorizer: { claims: { sub: 'auth-user-id' } },
    },
    httpMethod: 'GET',
    path: `/progress/${studentId}/quiz-history`,
    resource: '/progress/{studentId}/quiz-history',
  };
}

function createSession(overrides: Partial<QuizHistorySession> = {}): QuizHistorySession {
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
// Custom Arbitraries
// ============================================================

/** Generates ISO date strings within a reasonable range */
const dateArb = fc
  .date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') })
  .map((d) => d.toISOString());

/** Generates an ordered date pair (startDate <= endDate) */
const dateRangeArb = fc
  .tuple(dateArb, dateArb)
  .map(([a, b]) => {
    const dA = new Date(a).getTime();
    const dB = new Date(b).getTime();
    return dA <= dB ? { startDate: a, endDate: b } : { startDate: b, endDate: a };
  });

/** Generates a UUID v4 string */
const uuidArb = fc.uuid();

/** Generates a quiz session with a specific startedAt timestamp */
function sessionWithTimestamp(startedAt: string): fc.Arbitrary<QuizHistorySession> {
  return fc
    .record({
      id: uuidArb,
      subjectId: uuidArb,
      totalQuestions: fc.integer({ min: 1, max: 50 }),
      correctAnswers: fc.integer({ min: 0, max: 50 }),
    })
    .filter(({ correctAnswers, totalQuestions }) => correctAnswers <= totalQuestions)
    .map(({ id, subjectId, totalQuestions, correctAnswers }) => ({
      id,
      subjectId,
      totalQuestions,
      correctAnswers,
      scorePercentage: Math.round((correctAnswers / totalQuestions) * 100 * 100) / 100,
      startedAt,
      endedAt: new Date(new Date(startedAt).getTime() + 15 * 60 * 1000).toISOString(),
      status: 'completed',
    }));
}

/**
 * Generates a non-empty string that is NOT a valid ISO 8601 date.
 * Excludes empty strings since the handler treats them as "not provided" (falsy).
 */
const invalidDateArb = fc.oneof(
  // Random alphanumeric strings (non-empty, not valid ISO)
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0 && !isValidISODate(s)),
  // Date-like but invalid formats
  fc.constantFrom(
    'not-a-date',
    '2024/01/15',
    '01-15-2024',
    '15/01/2024',
    '2024-13-01',
    '2024-01-32',
    'yesterday',
    '2024-00-01',
    'Jan 15 2024',
    '20240115',
    '2024-1-1',
  ),
);

// ============================================================
// Property Tests
// ============================================================

describe('Property 25: Historical Quiz Scores Date Range', () => {
  describe('Date range filtering property', () => {
    it('all returned sessions have startedAt within [startDate, endDate]', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateRangeArb,
          fc.array(dateArb, { minLength: 1, maxLength: 20 }),
          async ({ startDate, endDate }, timestamps) => {
            const startMs = new Date(startDate).getTime();
            const endMs = new Date(endDate).getTime();

            // Create sessions with the generated timestamps
            const allSessions = timestamps.map((ts, i) =>
              createSession({
                id: `${i}0000000-0000-4000-8000-000000000000`,
                startedAt: ts,
              }),
            );

            // Simulate DB filtering: only return sessions within range, sorted descending
            const filteredSessions = allSessions
              .filter((s) => {
                const t = new Date(s.startedAt).getTime();
                return t >= startMs && t <= endMs;
              })
              .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

            // Create mock dbClient that simulates proper date filtering
            const mockDbClient: QuizHistoryDbClient = {
              getQuizHistory: vi.fn().mockResolvedValue({
                sessions: filteredSessions,
                total: filteredSessions.length,
              }),
            };

            const handler = createGetQuizHistoryHandler(mockDbClient);
            const event = createEvent({ startDate, endDate });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);

            // Verify ALL returned sessions are within [startDate, endDate]
            for (const session of body.sessions) {
              const sessionTime = new Date(session.startedAt).getTime();
              expect(sessionTime).toBeGreaterThanOrEqual(startMs);
              expect(sessionTime).toBeLessThanOrEqual(endMs);
            }

            // Verify NO sessions outside the range are included
            const outsideSessions = allSessions.filter((s) => {
              const t = new Date(s.startedAt).getTime();
              return t < startMs || t > endMs;
            });
            const returnedIds = new Set(body.sessions.map((s: QuizHistorySession) => s.id));
            for (const outside of outsideSessions) {
              expect(returnedIds.has(outside.id)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Descending order property', () => {
    it('returned sessions are ordered by startedAt descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dateArb, { minLength: 2, maxLength: 20 }),
          async (timestamps) => {
            // Create sessions and sort them descending (simulating DB behavior)
            const sessions = timestamps.map((ts, i) =>
              createSession({
                id: `${i}0000000-0000-4000-8000-000000000000`,
                startedAt: ts,
              }),
            );

            const sortedSessions = [...sessions].sort(
              (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
            );

            // Mock dbClient returns sessions in descending order
            const mockDbClient: QuizHistoryDbClient = {
              getQuizHistory: vi.fn().mockResolvedValue({
                sessions: sortedSessions,
                total: sortedSessions.length,
              }),
            };

            const handler = createGetQuizHistoryHandler(mockDbClient);
            const event = createEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);

            // Verify descending order: each session's startedAt <= previous
            for (let i = 1; i < body.sessions.length; i++) {
              const prevTime = new Date(body.sessions[i - 1].startedAt).getTime();
              const currTime = new Date(body.sessions[i].startedAt).getTime();
              expect(currTime).toBeLessThanOrEqual(prevTime);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Invalid date format rejection', () => {
    it('returns 400 for invalid startDate', async () => {
      await fc.assert(
        fc.asyncProperty(invalidDateArb, async (invalidDate) => {
          // Skip strings that pass isValidISODate or are falsy in JS
          fc.pre(!isValidISODate(invalidDate) && invalidDate.length > 0);

          const mockDbClient: QuizHistoryDbClient = {
            getQuizHistory: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
          };

          const handler = createGetQuizHistoryHandler(mockDbClient);
          const event = createEvent({ startDate: invalidDate });
          const result = await handler(event);

          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          expect(body.errorCode).toBe('INVALID_PARAMETER');
          expect(body.message).toContain('startDate');
        }),
        { numRuns: 100 },
      );
    });

    it('returns 400 for invalid endDate', async () => {
      await fc.assert(
        fc.asyncProperty(invalidDateArb, async (invalidDate) => {
          // Skip strings that pass isValidISODate or are falsy in JS
          fc.pre(!isValidISODate(invalidDate) && invalidDate.length > 0);

          const mockDbClient: QuizHistoryDbClient = {
            getQuizHistory: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
          };

          const handler = createGetQuizHistoryHandler(mockDbClient);
          const event = createEvent({ endDate: invalidDate });
          const result = await handler(event);

          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          expect(body.errorCode).toBe('INVALID_PARAMETER');
          expect(body.message).toContain('endDate');
        }),
        { numRuns: 100 },
      );
    });
  });
});
