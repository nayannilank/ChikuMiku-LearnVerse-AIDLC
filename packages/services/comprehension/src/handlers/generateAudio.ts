/**
 * Generate Audio Handler
 *
 * POST /chapters/:id/explanation/audio
 *
 * Generates TTS audio narration of a chapter explanation via Google TTS
 * through the AI Gateway. Stores the MP3 in S3 and serves via CloudFront CDN URL.
 *
 * Implements the generate-once pattern: if audio already exists for the
 * chapter page, returns the cached CDN URL without re-generating.
 *
 * Requirements: 10.4
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import { createHash } from 'crypto';

// ============================================================
// Types
// ============================================================

export interface GenerateAudioRequest {
  pageNumber: number;
}

export interface GenerateAudioSuccessResponse {
  success: true;
  audioUrl: string;
  s3Key: string;
}

export interface GenerateAudioErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface TtsAiGatewayClient {
  /**
   * Processes a TTS request through the AI Gateway.
   * Returns the S3 asset key and CDN URL for the generated audio.
   */
  process(request: {
    cacheKey: string;
    serviceType: 'tts';
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<TtsGatewayResponse>;
}

export interface TtsGatewayResponse {
  cached: boolean;
  data: Record<string, unknown>;
  s3AssetKey?: string;
  cdnUrl?: string;
}

export interface AudioDbClient {
  /** Checks if the chapter exists */
  chapterExists(chapterId: string): Promise<boolean>;
  /** Gets the explanation text for a specific chapter page */
  getExplanationText(chapterId: string, pageNumber: number): Promise<string | null>;
  /** Gets the total number of pages in the chapter */
  getChapterPageCount(chapterId: string): Promise<number>;
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

/**
 * Builds the deterministic cache key for TTS audio.
 * Pattern: chapter:{chapterId}:page:{pageNumber}:tts
 */
export function buildTtsCacheKey(chapterId: string, pageNumber: number): string {
  return `chapter:${chapterId}:page:${pageNumber}:tts`;
}

/**
 * Computes SHA-256 hash of the TTS payload for cache validation.
 */
export function computeTtsRequestHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a generateAudio Lambda handler with injected dependencies.
 *
 * The handler:
 * 1. Validates the chapter ID and page number
 * 2. Retrieves the explanation text for the chapter page
 * 3. Builds a deterministic cache key from chapter ID + page number
 * 4. Calls the AI Gateway with serviceType 'tts' and the explanation text
 * 5. Returns { audioUrl: cdnUrl, s3Key: s3AssetKey } with CloudFront CDN URL
 */
export function createGenerateAudioHandler(
  aiGateway: TtsAiGatewayClient,
  dbClient: AudioDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // 1. Extract and validate chapter ID from path
      const chapterId = event.pathParameters?.id;

      if (!chapterId || !isValidUUID(chapterId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid chapter ID');
      }

      // 2. Parse and validate request body
      if (!event.body) {
        return errorResponse(400, 'MISSING_BODY', 'Request body is required');
      }

      let body: GenerateAudioRequest;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      const { pageNumber } = body;

      if (pageNumber === undefined || pageNumber === null) {
        return errorResponse(400, 'MISSING_PAGE_NUMBER', 'pageNumber is required');
      }

      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return errorResponse(400, 'INVALID_PAGE_NUMBER', 'pageNumber must be a positive integer');
      }

      // 3. Verify chapter exists
      const exists = await dbClient.chapterExists(chapterId);
      if (!exists) {
        return errorResponse(404, 'CHAPTER_NOT_FOUND', `Chapter ${chapterId} not found`);
      }

      // 4. Validate page number is within range
      const pageCount = await dbClient.getChapterPageCount(chapterId);
      if (pageNumber > pageCount) {
        return errorResponse(
          400,
          'PAGE_OUT_OF_RANGE',
          `Page ${pageNumber} exceeds chapter page count of ${pageCount}`,
        );
      }

      // 5. Get the explanation text for the chapter page
      const explanationText = await dbClient.getExplanationText(chapterId, pageNumber);

      if (!explanationText || explanationText.trim().length === 0) {
        return errorResponse(
          400,
          'NO_EXPLANATION',
          'No explanation text available for this page. Generate an explanation first.',
        );
      }

      // 6. Build cache key and request hash
      const cacheKey = buildTtsCacheKey(chapterId, pageNumber);
      const requestHash = computeTtsRequestHash(explanationText);

      // 7. Call AI Gateway with TTS service type (generate-once pattern)
      const gatewayResponse = await aiGateway.process({
        cacheKey,
        serviceType: 'tts',
        requestHash,
        payload: {
          text: explanationText,
          chapterId,
          pageNumber,
        },
      });

      // 8. Verify we got back the expected audio asset info
      if (!gatewayResponse.s3AssetKey || !gatewayResponse.cdnUrl) {
        return errorResponse(
          500,
          'TTS_GENERATION_FAILED',
          'Audio generation did not return expected asset information',
        );
      }

      // 9. Return success response with CDN URL
      const response: GenerateAudioSuccessResponse = {
        success: true,
        audioUrl: gatewayResponse.cdnUrl,
        s3Key: gatewayResponse.s3AssetKey,
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
        'An unexpected error occurred during audio generation',
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
  const body: GenerateAudioErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
