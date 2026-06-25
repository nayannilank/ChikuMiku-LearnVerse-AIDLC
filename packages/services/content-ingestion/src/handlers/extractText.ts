/**
 * Extract Text Handler
 *
 * POST /chapters/:id/extract
 *
 * Triggers OCR text extraction for all pending pages in a chapter.
 * Calls AI Gateway → Google Vision OCR for each page image.
 * Updates `chapter_pages.extracted_text` and `ocr_status` on completion.
 *
 * Supports: Kannada, English, Hindi, mathematical notation, Indic scripts.
 *
 * Handles partial failure: marks failed pages with ocr_status='failed'
 * while showing successfully extracted pages normally.
 *
 * Requirements: 9.1, 9.2, 9.9, 9.10
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import type { OcrStatus, ChapterPageRecord } from './uploadPages';

// ============================================================
// Types
// ============================================================

export interface OcrRequest {
  imageS3Key: string;
  languageHints: string[];
}

export interface OcrResponse {
  extractedText: string;
  confidence: number;
  detectedLanguages: string[];
}

export interface PageExtractionResult {
  pageId: string;
  pageNumber: number;
  ocrStatus: OcrStatus;
  extractedText: string | null;
  wordCount: number;
  error?: string;
}

export interface ExtractTextSuccessResponse {
  success: true;
  chapterId: string;
  results: PageExtractionResult[];
  summary: {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    totalWordCount: number;
  };
}

export interface ExtractTextErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface AiGatewayClient {
  /**
   * Calls OCR service via AI Gateway with a 30-second timeout.
   * Supports Kannada, English, Hindi, mathematical notation, and Indic scripts.
   */
  extractTextFromImage(request: OcrRequest): Promise<OcrResponse>;
}

export interface ExtractDbClient {
  getChapterPages(chapterId: string): Promise<ChapterPageRecord[]>;
  updatePageOcrStatus(
    pageId: string,
    status: OcrStatus,
    extractedText: string | null,
    wordCount: number,
  ): Promise<void>;
  updateChapterWordCount(chapterId: string, totalWordCount: number): Promise<void>;
  chapterExists(chapterId: string): Promise<boolean>;
}

// ============================================================
// Constants
// ============================================================

/** Language hints for Google Vision OCR to support all required scripts */
export const DEFAULT_LANGUAGE_HINTS = [
  'en',  // English
  'kn',  // Kannada
  'hi',  // Hindi
  'sa',  // Sanskrit (Indic scripts support)
  'ta',  // Tamil
  'te',  // Telugu
  'mr',  // Marathi
];

const OCR_TIMEOUT_MS = 30_000;

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

/**
 * Counts words in extracted text using whitespace-separated token counting.
 * Handles multiple whitespace characters and trims leading/trailing whitespace.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't
 * resolve within the specified milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OCR request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates an extractText Lambda handler with injected dependencies.
 *
 * The handler processes each page sequentially, calling the AI Gateway
 * for OCR. On per-page failure, it marks that page as 'failed' and
 * continues processing remaining pages (partial failure handling).
 */
export function createExtractTextHandler(
  aiGateway: AiGatewayClient,
  dbClient: ExtractDbClient,
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

      // Get all pages for the chapter
      const pages = await dbClient.getChapterPages(chapterId);

      if (pages.length === 0) {
        return errorResponse(400, 'NO_PAGES', 'No pages found for this chapter. Upload pages first.');
      }

      // Filter to pages that need OCR (pending status)
      const pendingPages = pages.filter((p) => p.ocrStatus === 'pending');

      if (pendingPages.length === 0) {
        // All pages already processed — return current state
        const results: PageExtractionResult[] = pages.map((p) => ({
          pageId: p.id,
          pageNumber: p.pageNumber,
          ocrStatus: p.ocrStatus,
          extractedText: p.extractedText,
          wordCount: p.wordCount,
        }));

        const successfulPages = pages.filter((p) => p.ocrStatus === 'completed');
        const failedPages = pages.filter((p) => p.ocrStatus === 'failed');
        const totalWordCount = successfulPages.reduce((sum, p) => sum + p.wordCount, 0);

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            chapterId,
            results,
            summary: {
              totalPages: pages.length,
              successfulPages: successfulPages.length,
              failedPages: failedPages.length,
              totalWordCount,
            },
          } satisfies ExtractTextSuccessResponse),
        };
      }

      // Parse optional language hints from request body
      let languageHints = DEFAULT_LANGUAGE_HINTS;
      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          if (body.languageHints && Array.isArray(body.languageHints)) {
            languageHints = body.languageHints;
          }
        } catch {
          // Ignore parse errors for optional body
        }
      }

      // Process each pending page — handle partial failures
      const results: PageExtractionResult[] = [];

      for (const page of pendingPages) {
        // Mark as processing
        await dbClient.updatePageOcrStatus(page.id, 'processing', null, 0);

        try {
          const ocrResponse = await withTimeout(
            aiGateway.extractTextFromImage({
              imageS3Key: page.s3ImageKey,
              languageHints,
            }),
            OCR_TIMEOUT_MS,
          );

          const wordCount = countWords(ocrResponse.extractedText);

          // Mark as completed
          await dbClient.updatePageOcrStatus(
            page.id,
            'completed',
            ocrResponse.extractedText,
            wordCount,
          );

          results.push({
            pageId: page.id,
            pageNumber: page.pageNumber,
            ocrStatus: 'completed',
            extractedText: ocrResponse.extractedText,
            wordCount,
          });
        } catch (err) {
          // Mark individual page as failed — continue with remaining pages
          const errorMessage = err instanceof Error ? err.message : 'Unknown OCR error';

          await dbClient.updatePageOcrStatus(page.id, 'failed', null, 0);

          results.push({
            pageId: page.id,
            pageNumber: page.pageNumber,
            ocrStatus: 'failed',
            extractedText: null,
            wordCount: 0,
            error: errorMessage,
          });
        }
      }

      // Include already-processed pages in the response for complete picture
      const alreadyProcessed = pages.filter((p) => p.ocrStatus !== 'pending');
      for (const page of alreadyProcessed) {
        results.push({
          pageId: page.id,
          pageNumber: page.pageNumber,
          ocrStatus: page.ocrStatus,
          extractedText: page.extractedText,
          wordCount: page.wordCount,
        });
      }

      // Sort results by page number for consistent display
      results.sort((a, b) => a.pageNumber - b.pageNumber);

      // Calculate summary
      const successfulPages = results.filter((r) => r.ocrStatus === 'completed');
      const failedPages = results.filter((r) => r.ocrStatus === 'failed');
      const totalWordCount = successfulPages.reduce((sum, r) => sum + r.wordCount, 0);

      // Update chapter total word count
      await dbClient.updateChapterWordCount(chapterId, totalWordCount);

      const response: ExtractTextSuccessResponse = {
        success: true,
        chapterId,
        results,
        summary: {
          totalPages: results.length,
          successfulPages: successfulPages.length,
          failedPages: failedPages.length,
          totalWordCount,
        },
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred during text extraction');
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
  const body: ExtractTextErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
