/**
 * Create Quiz Session Handler
 *
 * POST /quiz/sessions
 *
 * Creates a new quiz session with a unique ID, fixed question set,
 * timer duration, and records the start time.
 *
 * Requirements: 21.1
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface CreateQuizSessionRequest {
  studentId: string;
  subjectId: string;
  questionIds: string[];
  timerDurationSeconds: number;
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

export interface QuizSessionDbClient {
  createSession(params: {
    studentId: string;
    subjectId: string;
    questionIds: string[];
    timerDurationSeconds: number;
  }): Promise<QuizSessionRecord>;
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

function validateRequest(body: unknown): { valid: true; data: CreateQuizSessionRequest } | { valid: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body is required' };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.studentId || typeof obj.studentId !== 'string' || !isValidUUID(obj.studentId)) {
    return { valid: false, message: 'studentId must be a valid UUID' };
  }

  if (!obj.subjectId || typeof obj.subjectId !== 'string' || !isValidUUID(obj.subjectId)) {
    return { valid: false, message: 'subjectId must be a valid UUID' };
  }

  if (!Array.isArray(obj.questionIds) || obj.questionIds.length === 0) {
    return { valid: false, message: 'questionIds must be a non-empty array of UUIDs' };
  }

  for (const qid of obj.questionIds) {
    if (typeof qid !== 'string' || !isValidUUID(qid)) {
      return { valid: false, message: 'Each questionId must be a valid UUID' };
    }
  }

  if (
    typeof obj.timerDurationSeconds !== 'number' ||
    !Number.isInteger(obj.timerDurationSeconds) ||
    obj.timerDurationSeconds < 30 ||
    obj.timerDurationSeconds > 3600
  ) {
    return { valid: false, message: 'timerDurationSeconds must be an integer between 30 and 3600' };
  }

  return {
    valid: true,
    data: {
      studentId: obj.studentId,
      subjectId: obj.subjectId,
      questionIds: obj.questionIds as string[],
      timerDurationSeconds: obj.timerDurationSeconds,
    },
  };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a createQuizSession Lambda handler with an injected database client.
 */
export function createCreateQuizSessionHandler(dbClient: QuizSessionDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
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

      const { studentId, subjectId, questionIds, timerDurationSeconds } = validation.data;

      const session = await dbClient.createSession({
        studentId,
        subjectId,
        questionIds,
        timerDurationSeconds,
      });

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify(session),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating quiz session',
        }),
      };
    }
  };
}
