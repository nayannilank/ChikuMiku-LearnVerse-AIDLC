/**
 * Get Quiz History Handler
 *
 * GET /progress/:studentId/quiz-history
 *
 * Returns historical quiz scores for a student with date range filtering,
 * subject filtering, and pagination. Only completed sessions are returned,
 * ordered by startedAt descending.
 *
 * Requirements: 19.6, 21.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface QuizHistorySession {
  id: string;
  subjectId: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
}

export interface QuizHistoryQuery {
  studentId: string;
  startDate?: string;
  endDate?: string;
  subjectId?: string;
  page: number;
  pageSize: number;
}

export interface QuizHistoryResult {
  sessions: QuizHistorySession[];
  total: number;
}

export interface QuizHistoryResponse {
  studentId: string;
  sessions: QuizHistorySession[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface QuizHistoryDbClient {
  getQuizHistory(query: QuizHistoryQuery): Promise<QuizHistoryResult>;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validates an ISO 8601 date string.
 * Accepts full ISO date-time (e.g., 2024-01-15T10:30:00Z) or date-only (e.g., 2024-01-15).
 */
export function isValidISODate(value: string): boolean {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return false;
  }
  // Ensure the string is a reasonable ISO format (not just any parseable date string)
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  return isoDatePattern.test(value);
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getQuizHistory Lambda handler with an injected database client.
 */
export function createGetQuizHistoryHandler(dbClient: QuizHistoryDbClient): LambdaHandler {
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
            message: 'Authentication required',
          }),
        };
      }

      // Validate studentId path parameter
      const studentId = event.pathParameters?.studentId;
      if (!studentId || !isValidUUID(studentId)) {
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

      // Parse and validate query parameters
      const queryParams = event.queryStringParameters || {};

      // Validate date parameters
      const startDate = queryParams.startDate;
      if (startDate && !isValidISODate(startDate)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'startDate must be a valid ISO 8601 date string',
          }),
        };
      }

      const endDate = queryParams.endDate;
      if (endDate && !isValidISODate(endDate)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'endDate must be a valid ISO 8601 date string',
          }),
        };
      }

      // Validate subjectId if provided
      const subjectId = queryParams.subjectId;
      if (subjectId && !isValidUUID(subjectId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'subjectId must be a valid UUID',
          }),
        };
      }

      // Parse pagination parameters
      const page = Math.max(DEFAULT_PAGE, parseInt(queryParams.page || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
      const rawPageSize = parseInt(queryParams.pageSize || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
      const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);

      // Query database
      const query: QuizHistoryQuery = {
        studentId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        subjectId: subjectId || undefined,
        page,
        pageSize,
      };

      const result = await dbClient.getQuizHistory(query);

      const response: QuizHistoryResponse = {
        studentId,
        sessions: result.sessions,
        total: result.total,
        page,
        pageSize,
        hasMore: page * pageSize < result.total,
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
          message: 'An unexpected error occurred while retrieving quiz history',
        }),
      };
    }
  };
}
