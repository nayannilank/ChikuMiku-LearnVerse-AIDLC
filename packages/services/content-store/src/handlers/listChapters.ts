/**
 * List Chapters Handler
 *
 * GET /books/:id/chapters
 *
 * Returns chapters in a book with name, sequence number, and completion status.
 *
 * Requirements: 7.5, 18.1
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface ChapterRecord {
  id: string;
  bookId: string;
  name: string;
  sequenceNumber: number;
  hasContent: boolean;
}

export interface ListChaptersDbClient {
  getChaptersForBook(bookId: string): Promise<ChapterRecord[]>;
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
 * Creates a listChapters Lambda handler with an injected database client.
 */
export function createListChaptersHandler(dbClient: ListChaptersDbClient): LambdaHandler {
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

      const bookId = event.pathParameters?.id;

      if (!bookId || !isValidUUID(bookId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Book ID must be a valid UUID',
          }),
        };
      }

      const chapters = await dbClient.getChaptersForBook(bookId);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ chapters }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving chapters',
        }),
      };
    }
  };
}
