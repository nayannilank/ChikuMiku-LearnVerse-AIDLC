/**
 * Get Summary Handler
 *
 * GET /chapters/:id/summary
 *
 * Retrieves a previously generated chapter summary. Returns the stored summary
 * if it exists, or 404 if the summary has not yet been generated.
 *
 * This handler complements the POST generateSummary endpoint, implementing
 * the "store permanently; return stored on subsequent requests" pattern.
 *
 * Requirements: 10.11, 10.13
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import type { ChapterSummary } from './generateSummary';

// ============================================================
// Types
// ============================================================

/** Success response */
export interface GetSummarySuccessResponse {
  success: true;
  summary: ChapterSummary;
}

/** Error response */
export interface GetSummaryErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

/** Database client for retrieving stored summaries */
export interface GetSummaryDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getSummary(chapterId: string): Promise<ChapterSummary | null>;
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
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getSummary Lambda handler with injected dependencies.
 *
 * Flow:
 * 1. Validate chapter ID from path params
 * 2. Verify chapter exists
 * 3. Look up cached summary
 * 4. Return stored summary or 404 if not yet generated
 */
export function createGetSummaryHandler(
  dbClient: GetSummaryDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract chapter ID from path
      const chapterId = event.pathParameters?.id;

      if (!chapterId || !isValidUUID(chapterId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid chapter ID');
      }

      // Verify chapter exists
      const exists = await dbClient.chapterExists(chapterId);
      if (!exists) {
        return errorResponse(404, 'CHAPTER_NOT_FOUND', `Chapter ${chapterId} not found`);
      }

      // Look up stored summary
      const summary = await dbClient.getSummary(chapterId);

      if (!summary) {
        return errorResponse(
          404,
          'SUMMARY_NOT_FOUND',
          `No summary has been generated for chapter ${chapterId}. Use POST /chapters/${chapterId}/summary to generate one.`,
        );
      }

      return successResponse(summary);
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while retrieving the chapter summary',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function successResponse(summary: ChapterSummary): APIGatewayProxyResult {
  const body: GetSummarySuccessResponse = {
    success: true,
    summary,
  };
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: GetSummaryErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
