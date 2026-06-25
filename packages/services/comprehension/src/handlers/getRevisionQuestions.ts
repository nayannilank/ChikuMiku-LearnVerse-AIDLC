/**
 * Get Revision Questions Handler
 *
 * GET /chapters/:id/revision-questions
 *
 * Retrieves stored revision questions for a chapter. Returns 404 if questions
 * have not yet been generated. This handler only reads from the permanent store
 * — it never invokes the AI service.
 *
 * Requirements: 10.10, 10.12
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import type { RevisionQuestion } from './generateRevisionQuestions';

// ============================================================
// Types
// ============================================================

/** Success response from the GET handler */
export interface GetRevisionQuestionsSuccessResponse {
  success: true;
  chapterId: string;
  questions: RevisionQuestion[];
}

/** Error response */
export interface GetRevisionQuestionsErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

/** Database client for reading revision questions */
export interface GetRevisionDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getRevisionQuestions(chapterId: string): Promise<RevisionQuestion[] | null>;
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
 * Creates a getRevisionQuestions Lambda handler with injected dependencies.
 *
 * Flow:
 * 1. Validate chapter ID from path params
 * 2. Verify chapter exists
 * 3. Look up stored revision questions
 * 4. Return questions or 404 if not yet generated
 */
export function createGetRevisionQuestionsHandler(
  dbClient: GetRevisionDbClient,
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

      // Fetch stored revision questions
      const questions = await dbClient.getRevisionQuestions(chapterId);

      if (!questions || questions.length === 0) {
        return errorResponse(
          404,
          'NOT_GENERATED',
          'Revision questions have not been generated for this chapter. Use POST to generate them first.',
        );
      }

      return successResponse(chapterId, questions);
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while fetching revision questions',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function successResponse(
  chapterId: string,
  questions: RevisionQuestion[],
): APIGatewayProxyResult {
  const body: GetRevisionQuestionsSuccessResponse = {
    success: true,
    chapterId,
    questions,
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
  const body: GetRevisionQuestionsErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
