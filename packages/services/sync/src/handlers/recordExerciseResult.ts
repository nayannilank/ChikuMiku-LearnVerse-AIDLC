/**
 * Record Exercise Result Handler
 *
 * POST /progress/:studentId/exercise-result
 *
 * Records an exercise result, updates subject progress percentage,
 * and triggers a streak update for the current day.
 *
 * Requirements: 19.1, 19.2, 19.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';
import { computeStreakUpdate, getToday } from './updateStreak';
import type { StreakRecord } from './updateStreak';

// ============================================================
// Types
// ============================================================

export interface RecordExerciseResultRequest {
  exerciseId: string;
  subjectId: string;
  isCorrect: boolean;
  score: number;
  answerGiven: unknown;
}

export interface ExerciseResultRecord {
  id: string;
  studentId: string;
  exerciseId: string;
  subjectId: string;
  isCorrect: boolean;
  score: number;
  answerGiven: unknown;
  completedAt: string;
}

export interface ProgressUpdate {
  completedExercises: number;
  totalExercises: number;
  progressPercentage: number;
}

export interface RecordExerciseResultResponse {
  result: ExerciseResultRecord;
  progressUpdate: ProgressUpdate;
  streakUpdate: {
    currentStreak: number;
    lastActivityDate: string;
    wasIncremented: boolean;
  };
}

export interface ExerciseResultDbClient {
  insertExerciseResult(params: {
    studentId: string;
    exerciseId: string;
    subjectId: string;
    isCorrect: boolean;
    score: number;
    answerGiven: unknown;
  }): Promise<ExerciseResultRecord>;

  getProgressForSubject(studentId: string, subjectId: string): Promise<{
    completedExercises: number;
    totalExercises: number;
  } | null>;

  updateProgress(params: {
    studentId: string;
    subjectId: string;
    completedExercises: number;
    progressPercentage: number;
  }): Promise<void>;

  getStreak(studentId: string): Promise<StreakRecord | null>;

  upsertStreak(params: {
    studentId: string;
    currentStreak: number;
    lastActivityDate: string;
    streakResetDate: string | null;
  }): Promise<void>;
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
// Handler Factory
// ============================================================

/**
 * Creates a recordExerciseResult Lambda handler with an injected database client.
 */
export function createRecordExerciseResultHandler(dbClient: ExerciseResultDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Authentication check
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing authentication credentials',
          }),
        };
      }

      const studentId = event.pathParameters?.studentId;

      if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Missing or invalid studentId path parameter',
          }),
        };
      }

      // Validate UUID format
      if (!isValidUUID(studentId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'studentId must be a valid UUID',
          }),
        };
      }

      // Parse request body
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

      let requestBody: RecordExerciseResultRequest;
      try {
        requestBody = JSON.parse(event.body);
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

      // Validate required fields
      const validationError = validateRequest(requestBody);
      if (validationError) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: validationError,
          }),
        };
      }

      // 1. Insert exercise result
      const resultRecord = await dbClient.insertExerciseResult({
        studentId,
        exerciseId: requestBody.exerciseId,
        subjectId: requestBody.subjectId,
        isCorrect: requestBody.isCorrect,
        score: requestBody.score,
        answerGiven: requestBody.answerGiven,
      });

      // 2. Update progress
      const currentProgress = await dbClient.getProgressForSubject(studentId, requestBody.subjectId);
      const completedExercises = (currentProgress?.completedExercises ?? 0) + 1;
      const totalExercises = currentProgress?.totalExercises ?? completedExercises;
      const progressPercentage = clampPercentage(
        Math.floor((completedExercises / totalExercises) * 100),
      );

      await dbClient.updateProgress({
        studentId,
        subjectId: requestBody.subjectId,
        completedExercises,
        progressPercentage,
      });

      // 3. Trigger streak update
      const today = getToday();
      const existingStreak = await dbClient.getStreak(studentId);
      const { currentStreak, wasIncremented, wasReset } = computeStreakUpdate(existingStreak, today);

      if (wasIncremented || wasReset) {
        await dbClient.upsertStreak({
          studentId,
          currentStreak,
          lastActivityDate: today,
          streakResetDate: wasReset ? today : (existingStreak?.streakResetDate ?? null),
        });
      }

      const response: RecordExerciseResultResponse = {
        result: resultRecord,
        progressUpdate: {
          completedExercises,
          totalExercises,
          progressPercentage,
        },
        streakUpdate: {
          currentStreak,
          lastActivityDate: today,
          wasIncremented,
        },
      };

      return {
        statusCode: 201,
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
          message: 'An unexpected error occurred while recording exercise result',
        }),
      };
    }
  };
}

// ============================================================
// Helpers
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function validateRequest(body: RecordExerciseResultRequest): string | null {
  if (!body.exerciseId || typeof body.exerciseId !== 'string' || !isValidUUID(body.exerciseId)) {
    return 'exerciseId must be a valid UUID';
  }
  if (!body.subjectId || typeof body.subjectId !== 'string' || !isValidUUID(body.subjectId)) {
    return 'subjectId must be a valid UUID';
  }
  if (typeof body.isCorrect !== 'boolean') {
    return 'isCorrect must be a boolean';
  }
  if (typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
    return 'score must be a number between 0 and 100';
  }
  if (body.answerGiven === undefined) {
    return 'answerGiven is required';
  }
  return null;
}
