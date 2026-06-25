/**
 * Logout Lambda Handler
 *
 * Persists progress, exercise results, and session data to PostgreSQL
 * before invalidating tokens via Cognito globalSignOut.
 *
 * Requirements: 1.39, 1.40, 1.41, 1.42
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from '@learnverse/service-core';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface StatePersistenceClient {
  saveUserState(userId: string, state: UserState): Promise<void>;
}

export interface CognitoSessionClient {
  globalSignOut(accessToken: string): Promise<void>;
}

// ============================================================
// State Types
// ============================================================

export interface PendingExerciseResult {
  exerciseId: string;
  isCorrect: boolean;
  score: number;
  answeredAt: string;
}

export interface UserState {
  progressPercentages: Record<string, number>;
  currentStreak: number;
  lastViewedChapterId: string | null;
  lastViewedPageNumber: number | null;
  pendingExerciseResults: PendingExerciseResult[];
}

interface LogoutRequestBody {
  state: UserState;
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

function isValidState(state: unknown): state is UserState {
  if (!state || typeof state !== 'object') return false;

  const s = state as Record<string, unknown>;

  // progressPercentages must be a record of string -> number
  if (!s.progressPercentages || typeof s.progressPercentages !== 'object') return false;
  for (const value of Object.values(s.progressPercentages as Record<string, unknown>)) {
    if (typeof value !== 'number') return false;
  }

  // currentStreak must be a non-negative number
  if (typeof s.currentStreak !== 'number' || s.currentStreak < 0) return false;

  // lastViewedChapterId must be string or null
  if (s.lastViewedChapterId !== null && typeof s.lastViewedChapterId !== 'string') return false;

  // lastViewedPageNumber must be number or null
  if (s.lastViewedPageNumber !== null && typeof s.lastViewedPageNumber !== 'number') return false;

  // pendingExerciseResults must be an array
  if (!Array.isArray(s.pendingExerciseResults)) return false;
  for (const result of s.pendingExerciseResults) {
    if (!result || typeof result !== 'object') return false;
    if (typeof result.exerciseId !== 'string') return false;
    if (typeof result.isCorrect !== 'boolean') return false;
    if (typeof result.score !== 'number') return false;
    if (typeof result.answeredAt !== 'string') return false;
  }

  return true;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a logout Lambda handler with injected dependencies.
 * This allows easy testing by providing mock persistence and Cognito clients.
 */
export function createLogoutHandler(
  statePersistenceClient: StatePersistenceClient,
  cognitoSessionClient: CognitoSessionClient,
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract user ID from JWT claims
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'No valid JWT provided',
          }),
        };
      }

      // Extract access token from Authorization header
      const authHeader = event.headers['Authorization'] || event.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'No valid JWT provided',
          }),
        };
      }
      const accessToken = authHeader.slice(7);

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

      let body: LogoutRequestBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      // Validate state object
      if (!body.state || !isValidState(body.state)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_STATE',
            message: 'Request body must contain a valid state object',
          }),
        };
      }

      // 1. Persist all pending state before logout
      await statePersistenceClient.saveUserState(userId, body.state);

      // 2. Invalidate the refresh token via Cognito globalSignOut
      await cognitoSessionClient.globalSignOut(accessToken);

      // 3. Return success (client clears local JWT tokens)
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'Logged out successfully',
          statePersisted: true,
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'Something went wrong — please try again after some time',
        }),
      };
    }
  };
}
