/**
 * Get Reference Audio Handler
 *
 * GET /pronunciation/reference/:wordId
 *
 * Returns the CDN URL for reference audio of a pronunciation word.
 * Implements the generate-once pattern:
 * - If reference audio already exists (S3 key stored in DB), returns its CDN URL
 * - If not, generates audio via Google TTS through the AI Gateway,
 *   stores it in S3, and returns the CDN URL
 *
 * Requirements: 12.3, 20.2, 20.3, 20.4, 20.5
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

export interface GetReferenceAudioSuccessResponse {
  success: true;
  /** CloudFront CDN URL for the reference audio */
  audioUrl: string;
  /** Word details */
  word: string;
  /** Language of the word */
  language: string;
  /** Phonetic transcription (if available) */
  phoneticTranscription: string | null;
  /** Syllable breakdown */
  syllables: string[];
}

export interface GetReferenceAudioErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface TtsAiGatewayClient {
  /**
   * Invokes Google TTS via the AI Gateway to generate reference audio.
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

export interface ReferenceAudioDbClient {
  /** Gets a pronunciation word by ID */
  getWord(wordId: string): Promise<ReferenceWordRecord | null>;
  /** Updates the reference audio S3 key for a word */
  updateReferenceAudioKey(wordId: string, s3Key: string): Promise<void>;
}

export interface ReferenceWordRecord {
  id: string;
  subjectId: string;
  word: string;
  phoneticTranscription: string | null;
  syllables: string[];
  referenceAudioS3Key: string | null;
  language: string;
}

export interface CdnConfig {
  /** CloudFront distribution base URL (e.g., https://d1234.cloudfront.net) */
  baseUrl: string;
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
 * Builds the deterministic cache key for reference audio TTS.
 * Pattern: pronunciation:reference:{wordId}:tts
 */
export function buildReferenceTtsCacheKey(wordId: string): string {
  return `pronunciation:reference:${wordId}:tts`;
}

/**
 * Computes SHA-256 hash of the TTS payload for cache validation.
 */
export function computeReferenceTtsRequestHash(word: string, language: string): string {
  return createHash('sha256').update(`${word}:${language}`).digest('hex');
}

/**
 * Builds the CDN URL from a base URL and S3 key.
 */
export function buildCdnUrl(baseUrl: string, s3Key: string): string {
  // Ensure base URL doesn't end with / and key doesn't start with /
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanKey = s3Key.replace(/^\//, '');
  return `${cleanBase}/${cleanKey}`;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getReferenceAudio Lambda handler with injected dependencies.
 *
 * The handler:
 * 1. Validates the word ID from the path parameter
 * 2. Looks up the pronunciation word in the database
 * 3. If reference audio already exists (generate-once pattern):
 *    - Returns the CDN URL directly
 * 4. If no reference audio exists:
 *    - Calls AI Gateway with Google TTS service type
 *    - Updates the word record with the new S3 key
 *    - Returns the CDN URL
 *
 * Requirements: 12.3, 20.2, 20.3, 20.4, 20.5
 */
export function createGetReferenceAudioHandler(
  aiGateway: TtsAiGatewayClient,
  dbClient: ReferenceAudioDbClient,
  cdnConfig: CdnConfig,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // 1. Extract and validate word ID from path
      const wordId = event.pathParameters?.wordId;

      if (!wordId || !isValidUUID(wordId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid word ID');
      }

      // 2. Look up the pronunciation word
      const wordRecord = await dbClient.getWord(wordId);
      if (!wordRecord) {
        return errorResponse(404, 'WORD_NOT_FOUND', `Pronunciation word ${wordId} not found`);
      }

      // 3. Check if reference audio already exists (generate-once pattern — Req 20.4)
      if (wordRecord.referenceAudioS3Key) {
        const audioUrl = buildCdnUrl(cdnConfig.baseUrl, wordRecord.referenceAudioS3Key);

        const response: GetReferenceAudioSuccessResponse = {
          success: true,
          audioUrl,
          word: wordRecord.word,
          language: wordRecord.language,
          phoneticTranscription: wordRecord.phoneticTranscription,
          syllables: wordRecord.syllables,
        };

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(response),
        };
      }

      // 4. Generate reference audio via Google TTS through AI Gateway (Req 20.2, 20.5)
      const cacheKey = buildReferenceTtsCacheKey(wordId);
      const requestHash = computeReferenceTtsRequestHash(wordRecord.word, wordRecord.language);

      const gatewayResponse = await aiGateway.process({
        cacheKey,
        serviceType: 'tts',
        requestHash,
        payload: {
          text: wordRecord.word,
          language: wordRecord.language,
          wordId,
          type: 'pronunciation_reference',
        },
      });

      // 5. Verify we got back the expected audio asset info
      if (!gatewayResponse.s3AssetKey || !gatewayResponse.cdnUrl) {
        return errorResponse(
          500,
          'TTS_GENERATION_FAILED',
          'Reference audio generation did not return expected asset information',
        );
      }

      // 6. Update the word record with the new S3 key (generate-once-store-permanently)
      await dbClient.updateReferenceAudioKey(wordId, gatewayResponse.s3AssetKey);

      // 7. Return success response with CDN URL (Req 20.3)
      const audioUrl = gatewayResponse.cdnUrl;

      const response: GetReferenceAudioSuccessResponse = {
        success: true,
        audioUrl,
        word: wordRecord.word,
        language: wordRecord.language,
        phoneticTranscription: wordRecord.phoneticTranscription,
        syllables: wordRecord.syllables,
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
        'An unexpected error occurred while retrieving reference audio',
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
  const body: GetReferenceAudioErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
