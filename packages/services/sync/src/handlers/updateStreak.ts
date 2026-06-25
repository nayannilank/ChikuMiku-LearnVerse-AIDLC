/**
 * Update Streak Handler
 *
 * Called on exercise completion to update the student's streak counter.
 *
 * Logic:
 * - Increment streak on the first exercise completed on a new calendar day
 * - Reset streak to 0 if two consecutive calendar days are missed
 * - No-op if an exercise was already completed today
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

export interface StreakUpdateResult {
  studentId: string;
  currentStreak: number;
  lastActivityDate: string;
  wasIncremented: boolean;
  wasReset: boolean;
}

export interface StreakDbClient {
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
// Streak Calculation Logic
// ============================================================

/**
 * Calculates the number of calendar days between two date strings (YYYY-MM-DD).
 * Returns the absolute difference in days.
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Returns today's date in YYYY-MM-DD format (UTC).
 */
export function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Computes the updated streak state given the current record and today's date.
 *
 * Rules:
 * - If no previous record exists: streak = 1, first day of activity
 * - If lastActivityDate === today: no change (already counted)
 * - If lastActivityDate === yesterday: increment streak (consecutive day)
 * - If gap is exactly 1 day (yesterday): increment streak
 * - If gap is >= 2 days: reset streak to 1 (student missed 2+ days, starts fresh)
 */
export function computeStreakUpdate(
  existing: StreakRecord | null,
  today: string,
): { currentStreak: number; wasIncremented: boolean; wasReset: boolean } {
  if (!existing || !existing.lastActivityDate) {
    // First ever activity — start at 1
    return { currentStreak: 1, wasIncremented: true, wasReset: false };
  }

  const lastDate = existing.lastActivityDate;
  const gap = daysBetween(today, lastDate);

  if (gap === 0) {
    // Already completed an exercise today — no change
    return {
      currentStreak: existing.currentStreak,
      wasIncremented: false,
      wasReset: false,
    };
  }

  if (gap === 1) {
    // Consecutive day — increment streak
    return {
      currentStreak: existing.currentStreak + 1,
      wasIncremented: true,
      wasReset: false,
    };
  }

  // Gap >= 2 days — missed two or more consecutive days, reset streak
  // Per requirement 5.4: reset to zero on second missed day
  // Since the student is now active again, start fresh at 1
  return { currentStreak: 1, wasIncremented: true, wasReset: true };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates an updateStreak Lambda handler with an injected database client.
 * This handler is called when a student completes an exercise.
 */
export function createUpdateStreakHandler(dbClient: StreakDbClient): LambdaHandler {
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

      const today = getToday();

      // Fetch current streak record
      const existing = await dbClient.getStreak(studentId);

      // Compute new streak state
      const { currentStreak, wasIncremented, wasReset } = computeStreakUpdate(existing, today);

      // Persist the updated streak
      if (wasIncremented || wasReset) {
        await dbClient.upsertStreak({
          studentId,
          currentStreak,
          lastActivityDate: today,
          streakResetDate: wasReset ? today : (existing?.streakResetDate ?? null),
        });
      }

      const response: StreakUpdateResult = {
        studentId,
        currentStreak,
        lastActivityDate: today,
        wasIncremented,
        wasReset,
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
          message: 'An unexpected error occurred while updating streak',
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
