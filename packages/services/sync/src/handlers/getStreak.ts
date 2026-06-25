/**
 * Get Streak Handler
 *
 * GET /progress/:studentId/streak
 *
 * Returns the current streak data for a student including the consecutive
 * day count and last activity date.
 *
 * Requirements: 5.1, 5.2, 5.4, 19.3, 19.4
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface StreakRecord {
  studentId: string;
  currentStreak: number;
  lastActivityDate: string | null;
  streakResetDate: string | null;
  updatedAt: string;
}

export interface StreakResponse {
  studentId: string;
  currentStreak: number;
  lastActivityDate: string | null;
}

export interface StreakDbClient {
  getStreak(studentId: string): Promise<StreakRecord | null>;
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
 * Creates a getStreak Lambda handler with an injected database client.
 * Allows easy testing by providing a mock DB client.
 */
export function createGetStreakHandler(dbClient: StreakDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
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

      const record = await dbClient.getStreak(studentId);

      if (!record) {
        // No streak record exists — return zero streak
        const response: StreakResponse = {
          studentId,
          currentStreak: 0,
          lastActivityDate: null,
        };

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(response),
        };
      }

      const response: StreakResponse = {
        studentId: record.studentId,
        currentStreak: record.currentStreak,
        lastActivityDate: record.lastActivityDate,
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
          message: 'An unexpected error occurred while retrieving streak data',
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
