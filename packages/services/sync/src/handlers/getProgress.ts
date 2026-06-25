/**
 * Get Progress Handler
 *
 * GET /progress/:studentId
 *
 * Returns per-subject progress percentages, current streak data,
 * and recent activity (last 10 exercise results) for a student.
 *
 * Requirements: 19.1, 19.2, 19.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface SubjectProgress {
  subjectId: string;
  completedExercises: number;
  totalExercises: number;
  progressPercentage: number;
}

export interface StreakData {
  currentStreak: number;
  lastActivityDate: string | null;
}

export interface RecentActivity {
  id: string;
  exerciseId: string;
  subjectId: string;
  isCorrect: boolean;
  score: number;
  completedAt: string;
}

export interface ProgressResponse {
  studentId: string;
  subjects: SubjectProgress[];
  streak: StreakData;
  recentActivity: RecentActivity[];
}

export interface ProgressDbClient {
  getSubjectProgress(studentId: string): Promise<SubjectProgress[]>;
  getStreak(studentId: string): Promise<StreakData | null>;
  getRecentActivity(studentId: string, limit: number): Promise<RecentActivity[]>;
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
 * Creates a getProgress Lambda handler with an injected database client.
 */
export function createGetProgressHandler(dbClient: ProgressDbClient): LambdaHandler {
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

      // Fetch progress data in parallel
      const [subjects, streakData, recentActivity] = await Promise.all([
        dbClient.getSubjectProgress(studentId),
        dbClient.getStreak(studentId),
        dbClient.getRecentActivity(studentId, 10),
      ]);

      const response: ProgressResponse = {
        studentId,
        subjects,
        streak: streakData ?? { currentStreak: 0, lastActivityDate: null },
        recentActivity,
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
          message: 'An unexpected error occurred while retrieving progress data',
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
