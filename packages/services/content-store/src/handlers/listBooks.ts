/**
 * List Books Handler
 *
 * GET /subjects/:id/books
 *
 * Returns books for a given subject including name and chapter count.
 *
 * Requirements: 7.3, 18.1
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface BookRecord {
  id: string;
  subjectId: string;
  name: string;
  sequenceNumber: number;
  chapterCount: number;
}

export interface ListBooksDbClient {
  getBooksForSubject(subjectId: string, studentId: string): Promise<BookRecord[]>;
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
// Helpers
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a listBooks Lambda handler with an injected database client.
 */
export function createListBooksHandler(dbClient: ListBooksDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const studentId = event.requestContext.authorizer?.claims?.sub;

      if (!studentId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing authentication',
          }),
        };
      }

      const subjectId = event.pathParameters?.id;

      if (!subjectId || !isValidUUID(subjectId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Subject ID must be a valid UUID',
          }),
        };
      }

      const books = await dbClient.getBooksForSubject(subjectId, studentId);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ books }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving books',
        }),
      };
    }
  };
}
