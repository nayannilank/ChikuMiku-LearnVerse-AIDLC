/**
 * Delete Exercise Handler
 *
 * DELETE /exercises/:id
 *
 * Deletes an existing exercise record. Returns 204 on success.
 * Auth check returns 401 if missing.
 *
 * Requirements: 18.1, 18.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface DeleteExerciseDbClient {
  deleteExercise(id: string): Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a deleteExercise Lambda handler with an injected database client.
 */
export function createDeleteExerciseHandler(dbClient: DeleteExerciseDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Auth check
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Authentication required',
          }),
        };
      }

      // Validate path parameter
      const exerciseId = event.pathParameters?.id;
      if (!exerciseId || !UUID_REGEX.test(exerciseId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Exercise ID must be a valid UUID',
          }),
        };
      }

      const deleted = await dbClient.deleteExercise(exerciseId);

      if (!deleted) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'NOT_FOUND',
            message: `Exercise with ID ${exerciseId} not found`,
          }),
        };
      }

      return {
        statusCode: 204,
        headers: CORS_HEADERS,
        body: '',
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the exercise',
        }),
      };
    }
  };
}
