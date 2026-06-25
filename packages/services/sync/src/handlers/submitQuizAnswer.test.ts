/**
 * Unit tests for submitQuizAnswer handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSubmitQuizAnswerHandler, evaluateAnswer } from './submitQuizAnswer';
import type { SubmitAnswerDbClient, QuizSessionRecord } from './submitQuizAnswer';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validSessionId = '880e8400-e29b-41d4-a716-446655440005';
const validQuestionId = '770e8400-e29b-41d4-a716-446655440002';
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

function createEvent(sessionId: string | undefined, body: unknown): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: sessionId ? { id: sessionId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: 'auth-user-id' } },
    },
    httpMethod: 'POST',
    path: `/quiz/sessions/${sessionId ?? ''}/answer`,
    resource: '/quiz/sessions/{id}/answer',
  };
}

function createMockDbClient(overrides?: Partial<SubmitAnswerDbClient>): SubmitAnswerDbClient {
  return {
    getSession: vi.fn().mockResolvedValue(activeSession),
    getAnswer: vi.fn().mockResolvedValue(null),
    getExercise: vi.fn().mockResolvedValue({ id: validQuestionId, correctAnswer: { option: 'B' } }),
    saveAnswer: vi.fn().mockResolvedValue(undefined),
    updateSessionScore: vi.fn().mockResolvedValue(undefined),
    getAnsweredCount: vi.fn().mockResolvedValue(1),
    getCorrectCount: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('submitQuizAnswer handler', () => {
  const validBody = {
    questionId: validQuestionId,
    selectedOption: 'B',
  };

  it('returns 200 with correct answer result', async () => {
    const dbClient = createMockDbClient();
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.sessionId).toBe(validSessionId);
    expect(body.questionId).toBe(validQuestionId);
    expect(body.isCorrect).toBe(true);
    expect(body.runningScore).toBe(100);
  });

  it('returns 200 with incorrect answer result', async () => {
    const dbClient = createMockDbClient({
      getCorrectCount: vi.fn().mockResolvedValue(0),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, { ...validBody, selectedOption: 'A' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.isCorrect).toBe(false);
    expect(body.runningScore).toBe(0);
  });

  it('returns 409 for duplicate answer submission (Req 21.4)', async () => {
    const dbClient = createMockDbClient({
      getAnswer: vi.fn().mockResolvedValue({
        sessionId: validSessionId,
        questionId: validQuestionId,
        selectedOption: 'B',
        isCorrect: true,
        answeredAt: '2024-01-15T10:01:00.000Z',
      }),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('DUPLICATE_ANSWER');
  });

  it('returns 404 when session does not exist', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(null),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('returns 409 when session is not active', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue({ ...activeSession, status: 'completed' }),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('SESSION_NOT_ACTIVE');
  });

  it('returns 400 when question does not belong to session', async () => {
    const dbClient = createMockDbClient();
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const otherQuestionId = '990e8400-e29b-41d4-a716-446655440099';
    const result = await handler(createEvent(validSessionId, { questionId: otherQuestionId, selectedOption: 'A' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_QUESTION');
  });

  it('returns 400 when selectedOption is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, { questionId: validQuestionId, selectedOption: 'E' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when session ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent('invalid-id', validBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('updates running score correctly (Req 21.2)', async () => {
    const dbClient = createMockDbClient({
      getAnsweredCount: vi.fn().mockResolvedValue(3),
      getCorrectCount: vi.fn().mockResolvedValue(2),
    });
    const handler = createSubmitQuizAnswerHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    // Running score = (2/3) × 100 = 66.67
    expect(body.runningScore).toBeCloseTo(66.67, 1);
    expect(body.answeredCount).toBe(3);
    expect(body.correctCount).toBe(2);
  });
});

describe('evaluateAnswer', () => {
  it('returns true when option matches correctAnswer.option', () => {
    expect(evaluateAnswer('A', { option: 'A' })).toBe(true);
  });

  it('returns false when option does not match', () => {
    expect(evaluateAnswer('A', { option: 'B' })).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(evaluateAnswer('a', { option: 'A' })).toBe(true);
  });

  it('supports correctAnswer.answer format', () => {
    expect(evaluateAnswer('C', { answer: 'C' })).toBe(true);
  });

  it('supports correctAnswer.correctOption format', () => {
    expect(evaluateAnswer('D', { correctOption: 'D' })).toBe(true);
  });

  it('returns false when correct answer is not a string', () => {
    expect(evaluateAnswer('A', { option: 42 })).toBe(false);
  });
});
