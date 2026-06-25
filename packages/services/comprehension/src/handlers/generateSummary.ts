/**
 * Generate Summary Handler
 *
 * POST /chapters/:id/summary
 *
 * Generates a chapter summary containing key points, important concepts,
 * and exam preparation notes via GPT-5 Mini through the AI Gateway.
 * Follows the generate-once-store-permanently pattern: once generated,
 * the summary is stored and returned on subsequent requests via GET.
 *
 * Requirements: 10.11, 10.13
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

/** A generated chapter summary */
export interface ChapterSummary {
  chapterId: string;
  keyPoints: string[];
  importantConcepts: string[];
  examPreparationNotes: string[];
  generatedAt: string;
}

/** Success response */
export interface GenerateSummarySuccessResponse {
  success: true;
  summary: ChapterSummary;
  cached: boolean;
}

/** Error response */
export interface GenerateSummaryErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

/** AI Gateway client interface */
export interface SummaryAiGatewayClient {
  process(request: AIGatewayRequest): Promise<AIGatewayResponse>;
}

/** Database client for chapter and summary operations */
export interface SummaryDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getChapterContent(chapterId: string): Promise<string | null>;
  getSummary(chapterId: string): Promise<ChapterSummary | null>;
  saveSummary(summary: ChapterSummary): Promise<void>;
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

const SUMMARY_PROMPT_INSTRUCTION =
  'Generate a chapter summary from the provided content. Return JSON with: ' +
  '1) keyPoints: an array of concise key points (strings) from the chapter. ' +
  '2) importantConcepts: an array of important concepts explained briefly. ' +
  '3) examPreparationNotes: an array of notes useful for exam preparation, ' +
  'including mnemonics, frequently tested topics, and common mistakes to avoid.';

// ============================================================
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Builds the deterministic cache key for a chapter summary.
 * Pattern: chapter:{chapterId}:summary
 */
export function buildCacheKey(chapterId: string): string {
  return `chapter:${chapterId}:summary`;
}

/**
 * Computes the SHA-256 hash of the request payload for cache validation.
 */
export function computeRequestHash(payload: Record<string, unknown>): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

/**
 * Parses the AI Gateway response data into a ChapterSummary.
 * Validates and normalizes the response structure.
 */
export function parseAiResponse(
  chapterId: string,
  data: Record<string, unknown>,
): ChapterSummary {
  const keyPoints = Array.isArray(data.keyPoints)
    ? data.keyPoints.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];

  const importantConcepts = Array.isArray(data.importantConcepts)
    ? data.importantConcepts.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    : [];

  const examPreparationNotes = Array.isArray(data.examPreparationNotes)
    ? data.examPreparationNotes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : [];

  return {
    chapterId,
    keyPoints,
    importantConcepts,
    examPreparationNotes,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a generateSummary Lambda handler with injected dependencies.
 *
 * Flow:
 * 1. Validate chapter ID from path params
 * 2. Check if summary already exists (generate-once-store-permanently)
 * 3. If cached, return stored summary
 * 4. Otherwise, get chapter content and call AI Gateway with serviceType 'summary'
 * 5. Parse AI response into ChapterSummary
 * 6. Store summary permanently and return it
 */
export function createGenerateSummaryHandler(
  aiGateway: SummaryAiGatewayClient,
  dbClient: SummaryDbClient,
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

      // Check if summary already exists (generate-once-store-permanently)
      const existingSummary = await dbClient.getSummary(chapterId);
      if (existingSummary) {
        return successResponse(existingSummary, true);
      }

      // Get chapter content for AI generation
      const chapterContent = await dbClient.getChapterContent(chapterId);
      if (!chapterContent || chapterContent.trim().length === 0) {
        return errorResponse(
          400,
          'NO_CONTENT',
          'Chapter has no content. Extract text from pages first.',
        );
      }

      // Build AI Gateway request
      const cacheKey = buildCacheKey(chapterId);
      const payload: Record<string, unknown> = {
        chapterId,
        chapterContent,
        instruction: SUMMARY_PROMPT_INSTRUCTION,
      };

      const requestHash = computeRequestHash(payload);

      const aiRequest: AIGatewayRequest = {
        cacheKey,
        serviceType: 'summary',
        requestHash,
        payload,
      };

      // Call AI Gateway
      const aiResponse = await aiGateway.process(aiRequest);

      // Parse AI response into ChapterSummary
      const summary = parseAiResponse(chapterId, aiResponse.data);

      if (
        summary.keyPoints.length === 0 &&
        summary.importantConcepts.length === 0 &&
        summary.examPreparationNotes.length === 0
      ) {
        return errorResponse(
          500,
          'GENERATION_FAILED',
          'AI service returned an empty summary. Please try again.',
        );
      }

      // Store summary permanently
      await dbClient.saveSummary(summary);

      return successResponse(summary, false);
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while generating the chapter summary',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function successResponse(
  summary: ChapterSummary,
  cached: boolean,
): APIGatewayProxyResult {
  const body: GenerateSummarySuccessResponse = {
    success: true,
    summary,
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
  const body: GenerateSummaryErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
