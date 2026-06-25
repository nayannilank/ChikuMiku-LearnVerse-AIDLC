/**
 * Unit tests for getQuizResult handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createGetQuizResultHandler, isTimerExpired } from './getQuizResult';
import type { GetQuizResultDbClient, QuizSessionRecord, QuizAnswerRecord } from './getQuizResult';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validSessionId = '880e8400-e29b-41d4-a716-446655440005';
const validQuestionIds = [
  '770e8400-e29b-41d4-a716-446655440002',
  '770e8400-e29b-41d4-a716-446655440003',
  '770e8400-e29b-41d4-a716-446655440004',
];

const activeSession: QuizSessionRecord = {
  id: validSessionId,
  studentId: '550e8400-e29b-41d4-a716-446655440000',
  subjectId: '660e8400-e29b-41d4-a716-446655440001',
  questionIds: validQuestionIds,
  timerDurationSeconds: 300,
  startedAt: '2024-01-15T10:00:00.000Z',
  endedAt: null,
  totalQuestions: 3,
  correctAnswers: 0,
  scorePercentage: null,
  status: 'active',
};

const completedSession: QuizSessionRecord = {
  ...activeSession,
  status: 'completed',
  endedAt: '2024-01-15T10:05:00.000Z',
  correctAnswers: 2,
  scorePercentage: 66.67,
};

const sampleAnswers: QuizAnswerRecord[] = [
  { sessionId: validSessionId, questionId: validQuestionIds[0], selectedOption: 'A', isCorrect: true, answeredAt: '2024-01-15T10:01:00.000Z' },
  { sessionId: validSessionId, questionId: validQuestionIds[1], selectedOption: 'B', isCorrect: true, answeredAt: '2024-01-15T10:02:00.000Z' },
  { sessionId: validSessionId, questionId: validQuestionIds[2], selectedOption: null, isCorrect: false, answeredAt: '2024-01-15T10:03:00.000Z' },
];

function createEvent(sessionId: string | undefined): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: sessionId ? { id: sessionId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: 'auth-user-id' } },
    },
    httpMethod: 'GET',
    path: `/quiz/sessions/${sessionId ?? ''}/result`,
    resource: '/quiz/sessions/{id}/result',
  };
}

function createMockDbClient(overrides?: Partial<GetQuizResultDbClient>): GetQuizResultDbClient {
  return {
    getSession: vi.fn().mockResolvedValue(completedSession),
    getAnswers: vi.fn().mockResolvedValue(sampleAnswers),
    finalizeSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('getQuizResult handler', () => {
  it('returns 200 with result for completed session', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.sessionId).toBe(validSessionId);
    expect(body.totalQuestions).toBe(3);
    expect(body.answeredQuestions).toBe(3);
    expect(body.correctAnswers).toBe(2);
    expect(body.skippedQuestions).toBe(1);
    expect(body.status).toBe('completed');
  });

  it('finalizes session when all questions answered (Req 21.5)', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(activeSession),
      getAnswers: vi.fn().mockResolvedValue(sampleAnswers), // 3 answers = all questions
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('completed');
    expect(dbClient.finalizeSession).toHaveBeenCalled();
    // Final score: (2/3) × 100 = 66.67 (Req 21.3)
    expect(body.scorePercentage).toBeCloseTo(66.67, 1);
  });

  it('finalizes session when timer has expired (Req 21.5)', async () => {
    // Set startedAt far in the past so timer is definitely expired
    const expiredSession: QuizSessionRecord = {
      ...activeSession,
      startedAt: '2020-01-01T00:00:00.000Z',
    };
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(expiredSession),
      getAnswers: vi.fn().mockResolvedValue([sampleAnswers[0]]), // Only 1 answer
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('completed');
    expect(dbClient.finalizeSession).toHaveBeenCalled();
    // Final score: (1/3) × 100 = 33.33
    expect(body.scorePercentage).toBeCloseTo(33.33, 1);
  });

  it('does not finalize active session when timer not expired and questions remain', async () => {
    // Set startedAt to now so timer is not expired
    const recentSession: QuizSessionRecord = {
      ...activeSession,
      startedAt: new Date().toISOString(),
    };
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(recentSession),
      getAnswers: vi.fn().mockResolvedValue([sampleAnswers[0]]), // Only 1 of 3 answered
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('active');
    expect(dbClient.finalizeSession).not.toHaveBeenCalled();
  });

  it('returns 404 when session does not exist', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(null),
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('returns 400 when session ID is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent('not-valid'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('calculates final score as (correct / total) × 100 (Req 21.3)', async () => {
    const answersAllCorrect: QuizAnswerRecord[] = [
      { sessionId: validSessionId, questionId: validQuestionIds[0], selectedOption: 'A', isCorrect: true, answeredAt: '2024-01-15T10:01:00.000Z' },
      { sessionId: validSessionId, questionId: validQuestionIds[1], selectedOption: 'B', isCorrect: true, answeredAt: '2024-01-15T10:02:00.000Z' },
      { sessionId: validSessionId, questionId: validQuestionIds[2], selectedOption: 'C', isCorrect: true, answeredAt: '2024-01-15T10:03:00.000Z' },
    ];
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(activeSession),
      getAnswers: vi.fn().mockResolvedValue(answersAllCorrect),
    });
    const handler = createGetQuizResultHandler(dbClient);

    const result = await handler(createEvent(validSessionId));

    const body = JSON.parse(result.body);
    expect(body.scorePercentage).toBe(100);
  });
});

describe('isTimerExpired', () => {
  it('returns true when elapsed time exceeds timer duration', () => {
    const pastTime = '2020-01-01T00:00:00.000Z';
    expect(isTimerExpired(pastTime, 300)).toBe(true);
  });

  it('returns false when elapsed time is within timer duration', () => {
    const now = new Date().toISOString();
    expect(isTimerExpired(now, 3600)).toBe(false);
  });

  it('returns true when exactly at timer boundary', () => {
    const past = new Date(Date.now() - 300 * 1000).toISOString();
    expect(isTimerExpired(past, 300)).toBe(true);
  });
});
