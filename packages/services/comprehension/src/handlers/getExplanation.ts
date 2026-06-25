/**
 * Get Explanation Handler
 *
 * GET /chapters/:id/explanation?page=N
 *
 * Generates or retrieves an AI-powered chapter explanation for a specific page.
 * Uses GPT-5 Mini via the AI Gateway to produce:
 * - Summary of the page content
 * - Key words with romanization and meaning
 * - Concepts/Moral section
 *
 * Implements generate-once-store-permanently pattern:
 * - Builds deterministic cache key: `chapter:{chapterId}:page:{pageNumber}:explanation`
 * - Calls AI Gateway which checks ai_cache before invoking GPT-5 Mini
 * - Subsequent requests for the same page return cached content immediately
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.9
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface KeyWord {
  word: string;
  romanization?: string;
  meaning: string;
  language: string;
}

export interface ChapterExplanation {
  chapterId: string;
  pageNumber: number;
  summary: string;
  keyWords: KeyWord[];
  concepts: string;
  audioS3Key?: string;
  audioCdnUrl?: string;
}

export interface GetExplanationSuccessResponse {
  success: true;
  explanation: ChapterExplanation;
  cached: boolean;
  totalPages: number;
}

export interface GetExplanationErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

/** Request structure sent to the AI Gateway */
export interface ExplanationAIGatewayRequest {
  cacheKey: string;
  serviceType: 'explanation';
  requestHash: string;
  payload: {
    chapterId: string;
    pageNumber: number;
    pageText: string;
    instruction: string;
  };
}

/** Response from the AI Gateway */
export interface ExplanationAIGatewayResponse {
  cached: boolean;
  data: Record<string, unknown>;
  s3AssetKey?: string;
  cdnUrl?: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface ExplanationAIGatewayClient {
  /**
   * Processes an AI request through the gateway.
   * Checks cache first, invokes GPT-5 Mini on cache miss.
   */
  process(request: ExplanationAIGatewayRequest): Promise<ExplanationAIGatewayResponse>;
}

export interface ExplanationDbClient {
  /** Checks if a chapter exists and returns its page count */
  getChapterInfo(chapterId: string): Promise<{ exists: boolean; pageCount: number } | null>;

  /** Gets the extracted text for a specific page of a chapter */
  getPageText(chapterId: string, pageNumber: number): Promise<string | null>;
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

const EXPLANATION_PROMPT_INSTRUCTION =
  'Generate a chapter explanation with the following structure: ' +
  '1) A concise summary of the page content. ' +
  '2) Key words with romanization (for non-Latin scripts) and their meanings. ' +
  '3) Important concepts or moral of the content. ' +
  'Return JSON with fields: summary (string), keyWords (array of {word, romanization, meaning, language}), concepts (string).';

// ============================================================
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Builds a deterministic cache key for a chapter page explanation.
 * Pattern: chapter:{chapterId}:page:{pageNumber}:explanation
 */
export function buildCacheKey(chapterId: string, pageNumber: number): string {
  return `chapter:${chapterId}:page:${pageNumber}:explanation`;
}

/**
 * Computes a simple hash of the request payload for cache validation.
 * Uses a basic string-based hash since SHA-256 requires crypto.
 */
export function computeRequestHash(chapterId: string, pageNumber: number, pageText: string): string {
  const input = `${chapterId}:${pageNumber}:${pageText.length}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Parses the AI Gateway response data into a ChapterExplanation.
 */
export function parseExplanationResponse(
  chapterId: string,
  pageNumber: number,
  data: Record<string, unknown>,
  s3AssetKey?: string,
  cdnUrl?: string,
): ChapterExplanation {
  const summary = typeof data.summary === 'string' ? data.summary : '';
  const concepts = typeof data.concepts === 'string' ? data.concepts : '';

  let keyWords: KeyWord[] = [];
  if (Array.isArray(data.keyWords)) {
    keyWords = data.keyWords
      .filter((kw): kw is Record<string, unknown> => kw !== null && typeof kw === 'object')
      .map((kw) => ({
        word: typeof kw.word === 'string' ? kw.word : '',
        romanization: typeof kw.romanization === 'string' ? kw.romanization : undefined,
        meaning: typeof kw.meaning === 'string' ? kw.meaning : '',
        language: typeof kw.language === 'string' ? kw.language : 'unknown',
      }));
  }

  return {
    chapterId,
    pageNumber,
    summary,
    keyWords,
    concepts,
    audioS3Key: s3AssetKey,
    audioCdnUrl: cdnUrl,
  };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getExplanation Lambda handler with injected dependencies.
 *
 * GET /chapters/:id/explanation?page=N
 *
 * Flow:
 * 1. Validate chapter ID and page number
 * 2. Verify chapter exists and page is within range
 * 3. Get page text from database
 * 4. Build cache key and call AI Gateway
 * 5. Parse and return ChapterExplanation response
 */
export function createGetExplanationHandler(
  aiGateway: ExplanationAIGatewayClient,
  dbClient: ExplanationDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract chapter ID from path parameters
      const chapterId = event.pathParameters?.id;

      if (!chapterId || !isValidUUID(chapterId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid chapter ID');
      }

      // Parse page number from query string (default: 1)
      const pageParam = event.queryStringParameters?.page;
      const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;

      if (isNaN(pageNumber) || pageNumber < 1) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Page number must be a positive integer');
      }

      // Verify chapter exists and get page count
      const chapterInfo = await dbClient.getChapterInfo(chapterId);

      if (!chapterInfo || !chapterInfo.exists) {
        return errorResponse(404, 'CHAPTER_NOT_FOUND', `Chapter ${chapterId} not found`);
      }

      if (chapterInfo.pageCount === 0) {
        return errorResponse(
          400,
          'NO_CONTENT',
          'Chapter has no pages. Upload and extract text first.',
        );
      }

      if (pageNumber > chapterInfo.pageCount) {
        return errorResponse(
          400,
          'PAGE_OUT_OF_RANGE',
          `Page ${pageNumber} exceeds total pages (${chapterInfo.pageCount})`,
        );
      }

      // Get the extracted text for this page
      const pageText = await dbClient.getPageText(chapterId, pageNumber);

      if (!pageText || pageText.trim().length === 0) {
        return errorResponse(
          400,
          'NO_TEXT_CONTENT',
          `No extracted text available for page ${pageNumber}. Run OCR extraction first.`,
        );
      }

      // Build cache key and request hash
      const cacheKey = buildCacheKey(chapterId, pageNumber);
      const requestHash = computeRequestHash(chapterId, pageNumber, pageText);

      // Call AI Gateway (handles cache check + GPT-5 Mini generation)
      const aiResponse = await aiGateway.process({
        cacheKey,
        serviceType: 'explanation',
        requestHash,
        payload: {
          chapterId,
          pageNumber,
          pageText,
          instruction: EXPLANATION_PROMPT_INSTRUCTION,
        },
      });

      // Parse AI response into ChapterExplanation
      const explanation = parseExplanationResponse(
        chapterId,
        pageNumber,
        aiResponse.data,
        aiResponse.s3AssetKey,
        aiResponse.cdnUrl,
      );

      const response: GetExplanationSuccessResponse = {
        success: true,
        explanation,
        cached: aiResponse.cached,
        totalPages: chapterInfo.pageCount,
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
        'An unexpected error occurred while generating the explanation',
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
  const body: GetExplanationErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
