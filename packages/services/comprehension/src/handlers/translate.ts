/**
 * Translate Handler
 *
 * POST /chapters/:id/translate
 *
 * Translates a chapter explanation into English or Hindi for language subjects
 * (Kannada, Hindi, English, and custom language subjects such as French)
 * via GPT-5 Mini through the AI Gateway.
 *
 * Implements generate-once-store-permanently pattern:
 * - Builds deterministic cache key: `chapter:{chapterId}:page:{pageNumber}:translation:{language}`
 * - Calls AI Gateway which checks ai_cache before invoking GPT-5 Mini
 * - Subsequent requests for the same page + language return cached content immediately
 *
 * Requirements: 10.14, 10.15, 10.16
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import type { AIGatewayRequest, AIGatewayResponse } from '@learnverse/service-ai-gateway';
import { createHash } from 'crypto';

// ============================================================
// Types
// ============================================================

/** Supported translation target languages */
export type TranslationLanguage = 'english' | 'hindi';

/** Request body for the translate endpoint */
export interface TranslateRequestBody {
  pageNumber: number;
  language: TranslationLanguage;
}

/** A translated chapter page */
export interface ChapterTranslation {
  chapterId: string;
  pageNumber: number;
  language: TranslationLanguage;
  translatedText: string;
  generatedAt: string;
}

/** Success response */
export interface TranslateSuccessResponse {
  success: true;
  translation: ChapterTranslation;
  cached: boolean;
}

/** Error response */
export interface TranslateErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

/** AI Gateway client interface for translations */
export interface TranslationAiGatewayClient {
  process(request: AIGatewayRequest): Promise<AIGatewayResponse>;
}

/** Database client for chapter and translation operations */
export interface TranslationDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getPageCount(chapterId: string): Promise<number>;
  getExplanation(chapterId: string, pageNumber: number): Promise<string | null>;
  getTranslation(chapterId: string, pageNumber: number, language: TranslationLanguage): Promise<ChapterTranslation | null>;
  saveTranslation(translation: ChapterTranslation): Promise<void>;
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

const VALID_LANGUAGES: TranslationLanguage[] = ['english', 'hindi'];

const TRANSLATION_PROMPT_INSTRUCTION =
  'Translate the following chapter explanation text into the target language. ' +
  'Preserve the structure and meaning of the content. ' +
  'Return JSON with field: translatedText (string containing the full translated text).';

// ============================================================
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Builds the deterministic cache key for a chapter page translation.
 * Pattern: chapter:{chapterId}:page:{pageNumber}:translation:{language}
 */
export function buildTranslationCacheKey(
  chapterId: string,
  pageNumber: number,
  language: TranslationLanguage,
): string {
  return `chapter:${chapterId}:page:${pageNumber}:translation:${language}`;
}

/**
 * Computes the SHA-256 hash of the request payload for cache validation.
 */
export function computeTranslationRequestHash(payload: Record<string, unknown>): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

/**
 * Validates the request body for the translate endpoint.
 * Returns a parsed body or null if invalid.
 */
export function parseTranslateBody(
  body: string | null,
): { valid: true; data: TranslateRequestBody } | { valid: false; error: string } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { valid: false, error: 'Invalid JSON in request body' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  // Validate pageNumber
  if (obj.pageNumber === undefined || obj.pageNumber === null) {
    return { valid: false, error: 'pageNumber is required' };
  }

  const pageNumber = Number(obj.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return { valid: false, error: 'pageNumber must be a positive integer' };
  }

  // Validate language
  if (!obj.language || typeof obj.language !== 'string') {
    return { valid: false, error: 'language is required' };
  }

  const language = obj.language.toLowerCase() as TranslationLanguage;
  if (!VALID_LANGUAGES.includes(language)) {
    return { valid: false, error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` };
  }

  return { valid: true, data: { pageNumber, language } };
}

/**
 * Parses the AI Gateway response data into a ChapterTranslation.
 */
export function parseTranslationResponse(
  chapterId: string,
  pageNumber: number,
  language: TranslationLanguage,
  data: Record<string, unknown>,
): ChapterTranslation {
  const translatedText = typeof data.translatedText === 'string'
    ? data.translatedText
    : '';

  return {
    chapterId,
    pageNumber,
    language,
    translatedText,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a translate Lambda handler with injected dependencies.
 *
 * POST /chapters/:id/translate
 * Body: { pageNumber: number, language: 'english' | 'hindi' }
 *
 * Flow:
 * 1. Validate chapter ID, page number, and target language
 * 2. Verify chapter exists and page is within range
 * 3. Check if translation already exists (generate-once-store-permanently)
 * 4. If cached, return stored translation
 * 5. Otherwise, get explanation text for the page
 * 6. Call AI Gateway with serviceType 'translation'
 * 7. Parse AI response and store translation permanently
 * 8. Return translated content
 */
export function createTranslateHandler(
  aiGateway: TranslationAiGatewayClient,
  dbClient: TranslationDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract and validate chapter ID from path
      const chapterId = event.pathParameters?.id;

      if (!chapterId || !isValidUUID(chapterId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid chapter ID');
      }

      // Parse and validate request body
      const bodyResult = parseTranslateBody(event.body);
      if (!bodyResult.valid) {
        return errorResponse(400, 'INVALID_PARAMETER', bodyResult.error);
      }

      const { pageNumber, language } = bodyResult.data;

      // Verify chapter exists
      const exists = await dbClient.chapterExists(chapterId);
      if (!exists) {
        return errorResponse(404, 'CHAPTER_NOT_FOUND', `Chapter ${chapterId} not found`);
      }

      // Verify page is within range
      const pageCount = await dbClient.getPageCount(chapterId);
      if (pageNumber > pageCount) {
        return errorResponse(
          400,
          'PAGE_OUT_OF_RANGE',
          `Page ${pageNumber} exceeds total pages (${pageCount})`,
        );
      }

      // Check if translation already exists (generate-once-store-permanently)
      const existingTranslation = await dbClient.getTranslation(chapterId, pageNumber, language);
      if (existingTranslation) {
        return successResponse(existingTranslation, true);
      }

      // Get the explanation text for this page
      const explanationText = await dbClient.getExplanation(chapterId, pageNumber);
      if (!explanationText || explanationText.trim().length === 0) {
        return errorResponse(
          400,
          'NO_EXPLANATION',
          `No explanation available for page ${pageNumber}. Generate the explanation first.`,
        );
      }

      // Build AI Gateway request
      const cacheKey = buildTranslationCacheKey(chapterId, pageNumber, language);
      const payload: Record<string, unknown> = {
        chapterId,
        pageNumber,
        explanationText,
        targetLanguage: language,
        instruction: TRANSLATION_PROMPT_INSTRUCTION,
      };

      const requestHash = computeTranslationRequestHash(payload);

      const aiRequest: AIGatewayRequest = {
        cacheKey,
        serviceType: 'translation',
        requestHash,
        payload,
      };

      // Call AI Gateway
      const aiResponse = await aiGateway.process(aiRequest);

      // Parse AI response into ChapterTranslation
      const translation = parseTranslationResponse(chapterId, pageNumber, language, aiResponse.data);

      if (!translation.translatedText || translation.translatedText.trim().length === 0) {
        return errorResponse(
          500,
          'GENERATION_FAILED',
          'AI service returned an empty translation. Please try again.',
        );
      }

      // Store translation permanently
      await dbClient.saveTranslation(translation);

      return successResponse(translation, false);
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while translating the chapter content',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function successResponse(
  translation: ChapterTranslation,
  cached: boolean,
): APIGatewayProxyResult {
  const body: TranslateSuccessResponse = {
    success: true,
    translation,
    cached,
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
  const body: TranslateErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
