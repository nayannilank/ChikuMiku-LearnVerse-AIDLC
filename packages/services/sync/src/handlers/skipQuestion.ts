/**
 * Skip Question Handler
 *
 * POST /quiz/sessions/:id/skip
 *
 * Records that a student skipped a question in a quiz session.
 * The skipped question is stored with null selectedOption.
 * Skipping counts toward the total answered questions but not toward correct answers.
 *
 * Requirements: 21.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface SkipQuestionRequest {
  questionId: string;
}

export interface QuizSessionRecord {
  id: string;
  studentId: string;
  subjectId: string;
  questionIds: string[];
  timerDurationSeconds: number;
  startedAt: string;
  endedAt: string | null;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number | null;
  status: 'active' | 'completed' | 'abandoned';
}

export interface QuizAnswerRecord {
  sessionId: string;
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  isCorrect: boolean;
  answeredAt: string;
}

export interface SkipQuestionResponse {
  sessionId: string;
  questionId: string;
  skipped: boolean;
  answeredCount: number;
  totalQuestions: number;
}

export interface SkipQuestionDbClient {
  getSession(sessionId: string): Promise<QuizSessionRecord | null>;
  getAnswer(sessionId: string, questionId: string): Promise<QuizAnswerRecord | null>;
  saveSkip(params: {
    sessionId: string;
    questionId: string;
  }): Promise<void>;
  getAnsweredCount(sessionId: string): Promise<number>;
}

// ============================================================
// CORS Headers
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function validateRequest(body: unknown): { valid: true; data: SkipQuestionRequest } | { valid: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body is required' };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.questionId || typeof obj.questionId !== 'string' || !isValidUUID(obj.questionId)) {
    return { valid: false, message: 'questionId must be a valid UUID' };
  }

  return {
    valid: true,
    data: {
      questionId: obj.questionId,
    },
  };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a skipQuestion Lambda handler with an injected database client.
 */
export function createSkipQuestionHandler(dbClient: SkipQuestionDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const sessionId = event.pathParameters?.id;

      if (!sessionId || !isValidUUID(sessionId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Session ID must be a valid UUID',
          }),
        };
      }

      if (!event.body) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_REQUEST',
            message: 'Request body is required',
          }),
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      const validation = validateRequest(parsed);
      if (!validation.valid) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: validation.message,
          }),
        };
      }

      const { questionId } = validation.data;

      // Verify session exists and is active
      const session = await dbClient.getSession(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'NOT_FOUND',
            message: 'Quiz session not found',
          }),
        };
      }

      if (session.status !== 'active') {
        return {
          statusCode: 409,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 409,
            errorCode: 'SESSION_NOT_ACTIVE',
            message: 'Quiz session is no longer active',
          }),
        };
      }

      // Verify question belongs to this session
      if (!session.questionIds.includes(questionId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_QUESTION',
            message: 'Question does not belong to this quiz session',
          }),
        };
      }

      // Check if question was already answered or skipped
      const existingAnswer = await dbClient.getAnswer(sessionId, questionId);
      if (existingAnswer) {
        return {
          statusCode: 409,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 409,
            errorCode: 'DUPLICATE_ANSWER',
            message: 'This question has already been answered or skipped in this session',
          }),
        };
      }

      // Save the skip
      await dbClient.saveSkip({ sessionId, questionId });

      // Get updated answered count
      const answeredCount = await dbClient.getAnsweredCount(sessionId);

      const response: SkipQuestionResponse = {
        sessionId,
        questionId,
        skipped: true,
        answeredCount,
        totalQuestions: session.totalQuestions,
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while skipping question',
        }),
      };
    }
  };
}
