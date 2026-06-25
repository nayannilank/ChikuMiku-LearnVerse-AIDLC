/**
 * Create Book Handler
 *
 * POST /subjects/:id/books
 *
 * Creates a new book under a subject with a name and auto-assigned sequence number.
 *
 * Requirements: 7.4, 18.1
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface CreatedBookRecord {
  id: string;
  subjectId: string;
  studentId: string;
  name: string;
  sequenceNumber: number;
}

export interface CreateBookDbClient {
  createBook(subjectId: string, studentId: string, name: string): Promise<CreatedBookRecord>;
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

function isValidBookName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 200;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a createBook Lambda handler with an injected database client.
 */
export function createCreateBookHandler(dbClient: CreateBookDbClient): LambdaHandler {
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

      if (!isValidBookName(name)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Book name must be between 1 and 200 characters',
          }),
        };
      }

      const book = await dbClient.createBook(subjectId, studentId, name.trim());

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({ book }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the book',
        }),
      };
    }
  };
}
