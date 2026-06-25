/**
 * Create Chapter Handler
 *
 * POST /books/:id/chapters
 *
 * Creates a new chapter in a book with a name and auto-assigned sequence number.
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

export interface CreatedChapterRecord {
  id: string;
  bookId: string;
  name: string;
  sequenceNumber: number;
  hasContent: boolean;
}

export interface CreateChapterDbClient {
  createChapter(bookId: string, name: string): Promise<CreatedChapterRecord>;
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

function isValidChapterName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 200;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a createChapter Lambda handler with an injected database client.
 */
export function createCreateChapterHandler(dbClient: CreateChapterDbClient): LambdaHandler {
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

      // Parse request body
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body ?? '{}');
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_BODY',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      const { name } = body;

      if (!isValidChapterName(name)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Chapter name must be between 1 and 200 characters',
          }),
        };
      }

      const chapter = await dbClient.createChapter(bookId, name.trim());

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({ chapter }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the chapter',
        }),
      };
    }
  };
}
