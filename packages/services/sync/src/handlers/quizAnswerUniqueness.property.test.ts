/**
 * Property Test: Quiz Answer Uniqueness
 *
 * Property 21: For any (sessionId, questionId) pair, submitting a duplicate answer
 * for the same question in the same session SHALL be rejected with 409 DUPLICATE_ANSWER.
 * Different questions in the same session and the same question in different sessions
 * can each be answered independently.
 *
 * **Validates: Requirements 21.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createSubmitQuizAnswerHandler } from './submitQuizAnswer';
import type {
  SubmitAnswerDbClient,
  QuizSessionRecord,
  QuizAnswerRecord,
} from './submitQuizAnswer';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Generators
// ============================================================

/** Arbitrary UUID v4 string */
const uuidArb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 12, maxLength: 12 }),
  )
  .map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`);

/** Arbitrary valid option */
const optionArb = fc.constantFrom('A' as const, 'B' as const, 'C' as const, 'D' as const);

// ============================================================
// Helpers
// ============================================================

/**
 * Creates a mock DB client that tracks submitted answers in an in-memory store.
 * This simulates real database behavior for duplicate detection.
 */
function createTrackingDbClient(registeredSessions: Map<string, QuizSessionRecord>) {
  const answers = new Map<string, QuizAnswerRecord>();

  const dbClient: SubmitAnswerDbClient = {
    getSession: async (sessionId: string) => {
      return registeredSessions.get(sessionId) ?? null;
    },
    getAnswer: async (sessionId: string, questionId: string) => {
      const key = `${sessionId}::${questionId}`;
      return answers.get(key) ?? null;
    },
    getExercise: async (_exerciseId: string) => {
      return { id: _exerciseId, correctAnswer: { option: 'B' } };
    },
    saveAnswer: async (params) => {
      const key = `${params.sessionId}::${params.questionId}`;
      answers.set(key, {
        sessionId: params.sessionId,
        questionId: params.questionId,
        selectedOption: params.selectedOption,
        isCorrect: params.isCorrect,
        answeredAt: new Date().toISOString(),
      });
    },
    updateSessionScore: async () => {},
    getAnsweredCount: async (sessionId: string) => {
      let count = 0;
      for (const key of answers.keys()) {
        if (key.startsWith(`${sessionId}::`)) count++;
      }
      return count;
    },
    getCorrectCount: async (sessionId: string) => {
      let count = 0;
      for (const [key, answer] of answers.entries()) {
        if (key.startsWith(`${sessionId}::`) && answer.isCorrect) count++;
      }
      return count;
    },
  };

  return { dbClient, answers };
}

/**
 * Creates an active session record that includes the given question IDs.
 */
function createActiveSession(sessionId: string, questionIds: string[]): QuizSessionRecord {
  return {
    id: sessionId,
    studentId: '550e8400-e29b-41d4-a716-446655440000',
    subjectId: '660e8400-e29b-41d4-a716-446655440001',
    questionIds,
    timerDurationSeconds: 300,
    startedAt: '2024-01-15T10:00:00.000Z',
    endedAt: null,
    totalQuestions: questionIds.length,
    correctAnswers: 0,
    scorePercentage: null,
    status: 'active',
  };
}

/**
 * Creates a minimal API Gateway event for submitting an answer.
 */
function createEvent(sessionId: string, questionId: string, option: string): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ questionId, selectedOption: option }),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: { id: sessionId },
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: 'auth-user-id' } },
    },
    httpMethod: 'POST',
    path: `/quiz/sessions/${sessionId}/answer`,
    resource: '/quiz/sessions/{id}/answer',
  };
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 21: Quiz Answer Uniqueness', () => {
  it('first answer submission for any (sessionId, questionId) pair succeeds with 200', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, optionArb, async (sessionId, questionId, option) => {
        const sessions = new Map<string, QuizSessionRecord>();
        sessions.set(sessionId, createActiveSession(sessionId, [questionId]));
        const { dbClient } = createTrackingDbClient(sessions);
        const handler = createSubmitQuizAnswerHandler(dbClient);

        const result = await handler(createEvent(sessionId, questionId, option));

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.sessionId).toBe(sessionId);
        expect(body.questionId).toBe(questionId);
      }),
      { numRuns: 100 },
    );
  });

  it('second answer for same (sessionId, questionId) is rejected with 409 DUPLICATE_ANSWER', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        optionArb,
        optionArb,
        async (sessionId, questionId, firstOption, secondOption) => {
          const sessions = new Map<string, QuizSessionRecord>();
          sessions.set(sessionId, createActiveSession(sessionId, [questionId]));
          const { dbClient } = createTrackingDbClient(sessions);
          const handler = createSubmitQuizAnswerHandler(dbClient);

          // First submission should succeed
          const first = await handler(createEvent(sessionId, questionId, firstOption));
          expect(first.statusCode).toBe(200);

          // Second submission for same (sessionId, questionId) must be rejected
          const second = await handler(createEvent(sessionId, questionId, secondOption));
          expect(second.statusCode).toBe(409);
          const body = JSON.parse(second.body);
          expect(body.errorCode).toBe('DUPLICATE_ANSWER');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('different questions in the same session can each be answered independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.uniqueArray(uuidArb, { minLength: 2, maxLength: 5 }),
        fc.array(optionArb, { minLength: 2, maxLength: 5 }),
        async (sessionId, questionIds, options) => {
          // Ensure we have an option for each question
          const paddedOptions = questionIds.map(
            (_, i) => options[i % options.length],
          );

          const sessions = new Map<string, QuizSessionRecord>();
          sessions.set(sessionId, createActiveSession(sessionId, questionIds));
          const { dbClient } = createTrackingDbClient(sessions);
          const handler = createSubmitQuizAnswerHandler(dbClient);

          // Each different question should be answerable independently
          for (let i = 0; i < questionIds.length; i++) {
            const result = await handler(
              createEvent(sessionId, questionIds[i], paddedOptions[i]),
            );
            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.questionId).toBe(questionIds[i]);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('same question in different sessions can each be answered independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(uuidArb, { minLength: 2, maxLength: 5 }),
        uuidArb,
        optionArb,
        async (sessionIds, questionId, option) => {
          const sessions = new Map<string, QuizSessionRecord>();
          for (const sid of sessionIds) {
            sessions.set(sid, createActiveSession(sid, [questionId]));
          }
          const { dbClient } = createTrackingDbClient(sessions);
          const handler = createSubmitQuizAnswerHandler(dbClient);

          // The same question can be answered in each different session
          for (const sid of sessionIds) {
            const result = await handler(createEvent(sid, questionId, option));
            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.sessionId).toBe(sid);
            expect(body.questionId).toBe(questionId);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
