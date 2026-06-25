/**
 * Save Transcript Handler
 *
 * PUT /chapters/:id/transcript
 *
 * Persists the transcript (original or edited) as the chapter content
 * in the database. Updates each page's extracted_text and word_count,
 * then sets chapter has_content = true and recalculates total_word_count.
 *
 * Requirements: 9.5, 9.6
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import { countWords } from './extractText';

// ============================================================
// Types
// ============================================================

export interface PageTranscript {
  /** ID of the chapter page */
  pageId: string;
  /** Page number (1-based) */
  pageNumber: number;
  /** The transcript text content (original or edited) */
  text: string;
}

export interface SaveTranscriptRequestBody {
  pages: PageTranscript[];
}

export interface SaveTranscriptSuccessResponse {
  success: true;
  chapterId: string;
  updatedPages: number;
  totalWordCount: number;
  hasContent: boolean;
}

export interface SaveTranscriptErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface TranscriptDbClient {
  /** Check if a chapter exists */
  chapterExists(chapterId: string): Promise<boolean>;
  /** Update a page's extracted text and word count */
  updatePageText(pageId: string, text: string, wordCount: number): Promise<void>;
  /** Update chapter metadata after transcript save */
  updateChapterContent(
    chapterId: string,
    hasContent: boolean,
    totalWordCount: number,
  ): Promise<void>;
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
 * Creates a saveTranscript Lambda handler with injected dependencies.
 *
 * The handler receives an array of page transcripts, updates each page's
 * extracted_text and word_count in the database, then sets the chapter's
 * has_content flag and recalculates total_word_count.
 */
export function createSaveTranscriptHandler(
  dbClient: TranscriptDbClient,
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

      // Parse request body
      if (!event.body) {
        return errorResponse(400, 'INVALID_REQUEST', 'Request body is required');
      }

      let body: SaveTranscriptRequestBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      // Validate pages array
      if (!body.pages || !Array.isArray(body.pages) || body.pages.length === 0) {
        return errorResponse(
          400,
          'INVALID_REQUEST',
          'At least one page transcript is required',
        );
      }

      // Validate each page transcript
      for (const page of body.pages) {
        if (!page.pageId || !isValidUUID(page.pageId)) {
          return errorResponse(
            400,
            'INVALID_PAGE_ID',
            `Invalid or missing page ID for page number ${page.pageNumber}`,
          );
        }

        if (page.pageNumber == null || page.pageNumber < 1 || !Number.isInteger(page.pageNumber)) {
          return errorResponse(
            400,
            'INVALID_PAGE_NUMBER',
            `Invalid page number: ${page.pageNumber}`,
          );
        }

        if (typeof page.text !== 'string') {
          return errorResponse(
            400,
            'INVALID_TEXT',
            `Page ${page.pageNumber}: text must be a string`,
          );
        }
      }

      // Update each page's text and word count
      let totalWordCount = 0;

      for (const page of body.pages) {
        const wordCount = countWords(page.text);
        totalWordCount += wordCount;
        await dbClient.updatePageText(page.pageId, page.text, wordCount);
      }

      // Update chapter metadata
      await dbClient.updateChapterContent(chapterId, true, totalWordCount);

      const response: SaveTranscriptSuccessResponse = {
        success: true,
        chapterId,
        updatedPages: body.pages.length,
        totalWordCount,
        hasContent: true,
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while saving the transcript',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: SaveTranscriptErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
