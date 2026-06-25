/**
 * Classify Pages Handler
 *
 * POST /chapters/:id/classify-pages
 *
 * AI classification to identify pages containing exercises (questions,
 * fill-in-the-blanks, problems). Returns classification results with
 * confidence levels, prompting the student for confirmation.
 *
 * Two modes:
 * 1. No body / no confirmedPages → run AI classification and return results
 * 2. confirmedPages provided → update chapter_pages.is_exercise_page
 *
 * Requirements: 11.1, 11.2
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import type { ChapterPageRecord } from './uploadPages';

// ============================================================
// Types
// ============================================================

export type ClassificationType = 'exercise' | 'content' | 'uncertain';

export interface ClassificationResult {
  pageId: string;
  pageNumber: number;
  classification: ClassificationType;
  confidence: number;
  prompt: string;
}

export interface ConfirmedPage {
  pageId: string;
  isExercise: boolean;
}

export interface ClassifyPagesRequestBody {
  confirmedPages?: ConfirmedPage[];
}

export interface ClassifyPagesClassificationResponse {
  success: true;
  chapterId: string;
  classifications: ClassificationResult[];
  summary: {
    totalPages: number;
    exercisePages: number;
    contentPages: number;
    uncertainPages: number;
  };
}

export interface ClassifyPagesConfirmationResponse {
  success: true;
  chapterId: string;
  updatedPages: Array<{ pageId: string; isExercisePage: boolean }>;
}

export interface ClassifyPagesErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// AI Classification Types
// ============================================================

export interface ClassificationRequest {
  text: string;
  pageNumber: number;
}

export interface ClassificationResponse {
  classification: ClassificationType;
  confidence: number;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface ClassificationAiClient {
  /**
   * Calls GPT-5 Mini via AI Gateway to classify whether extracted text
   * contains exercises (questions, fill-in-the-blanks, problems).
   */
  classifyPageContent(request: ClassificationRequest): Promise<ClassificationResponse>;
}

export interface ClassifyDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getCompletedPages(chapterId: string): Promise<ChapterPageRecord[]>;
  updatePageExerciseStatus(pageId: string, isExercise: boolean): Promise<void>;
}

// ============================================================
// Constants
// ============================================================

/** Confidence threshold above which classification is considered reliable */
export const CONFIDENCE_THRESHOLD = 0.7;

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
 * Generates the confirmation prompt based on classification result.
 *
 * - Exercise with high confidence → "This page appears to contain exercises. Confirm?"
 * - Uncertain → asks student to manually classify
 * - Content → informs it's regular content
 */
export function generatePrompt(classification: ClassificationType, confidence: number): string {
  if (classification === 'exercise' && confidence >= CONFIDENCE_THRESHOLD) {
    return 'This page appears to contain exercises. Confirm?';
  }

  if (classification === 'uncertain' || confidence < CONFIDENCE_THRESHOLD) {
    return 'Unable to determine if this page contains exercises. Please classify manually.';
  }

  return 'This page appears to contain regular content (not exercises).';
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a classifyPages Lambda handler with injected dependencies.
 *
 * The handler supports two flows:
 * 1. Classification: Fetches pages with completed OCR, runs AI classification,
 *    and returns results with confidence levels and confirmation prompts.
 * 2. Confirmation: Receives student-confirmed exercise classifications and
 *    updates the database accordingly.
 */
export function createClassifyPagesHandler(
  aiClient: ClassificationAiClient,
  dbClient: ClassifyDbClient,
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

      // Parse optional request body
      let confirmedPages: ConfirmedPage[] | undefined;
      if (event.body) {
        try {
          const body: ClassifyPagesRequestBody = JSON.parse(event.body);
          confirmedPages = body.confirmedPages;
        } catch {
          return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
        }
      }

      // ── Flow 2: Confirmation ──────────────────────────────────
      if (confirmedPages && confirmedPages.length > 0) {
        return handleConfirmation(dbClient, chapterId, confirmedPages);
      }

      // ── Flow 1: Classification ────────────────────────────────
      return handleClassification(aiClient, dbClient, chapterId);
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred during page classification');
    }
  };
}

// ============================================================
// Flow Handlers
// ============================================================

async function handleClassification(
  aiClient: ClassificationAiClient,
  dbClient: ClassifyDbClient,
  chapterId: string,
): Promise<APIGatewayProxyResult> {
  // Fetch pages with completed OCR
  const pages = await dbClient.getCompletedPages(chapterId);

  if (pages.length === 0) {
    return errorResponse(
      400,
      'NO_COMPLETED_PAGES',
      'No pages with completed OCR found. Run text extraction first.',
    );
  }

  // Classify each page using AI
  const classifications: ClassificationResult[] = [];

  for (const page of pages) {
    // Skip pages without extracted text
    if (!page.extractedText) {
      continue;
    }

    try {
      const result = await aiClient.classifyPageContent({
        text: page.extractedText,
        pageNumber: page.pageNumber,
      });

      classifications.push({
        pageId: page.id,
        pageNumber: page.pageNumber,
        classification: result.classification,
        confidence: result.confidence,
        prompt: generatePrompt(result.classification, result.confidence),
      });
    } catch {
      // If AI classification fails for a page, mark as uncertain
      classifications.push({
        pageId: page.id,
        pageNumber: page.pageNumber,
        classification: 'uncertain',
        confidence: 0,
        prompt: 'Unable to determine if this page contains exercises. Please classify manually.',
      });
    }
  }

  // Sort by page number
  classifications.sort((a, b) => a.pageNumber - b.pageNumber);

  // Calculate summary
  const exercisePages = classifications.filter(
    (c) => c.classification === 'exercise' && c.confidence >= CONFIDENCE_THRESHOLD,
  ).length;
  const uncertainPages = classifications.filter(
    (c) => c.classification === 'uncertain' || c.confidence < CONFIDENCE_THRESHOLD,
  ).length;
  const contentPages = classifications.length - exercisePages - uncertainPages;

  const response: ClassifyPagesClassificationResponse = {
    success: true,
    chapterId,
    classifications,
    summary: {
      totalPages: classifications.length,
      exercisePages,
      contentPages,
      uncertainPages,
    },
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

async function handleConfirmation(
  dbClient: ClassifyDbClient,
  chapterId: string,
  confirmedPages: ConfirmedPage[],
): Promise<APIGatewayProxyResult> {
  // Validate confirmed pages
  for (const page of confirmedPages) {
    if (!page.pageId || !isValidUUID(page.pageId)) {
      return errorResponse(
        400,
        'INVALID_PAGE_ID',
        `Invalid page ID: ${page.pageId}`,
      );
    }

    if (typeof page.isExercise !== 'boolean') {
      return errorResponse(
        400,
        'INVALID_CONFIRMATION',
        `Page ${page.pageId}: isExercise must be a boolean`,
      );
    }
  }

  // Update each page
  const updatedPages: Array<{ pageId: string; isExercisePage: boolean }> = [];

  for (const page of confirmedPages) {
    await dbClient.updatePageExerciseStatus(page.pageId, page.isExercise);
    updatedPages.push({ pageId: page.pageId, isExercisePage: page.isExercise });
  }

  const response: ClassifyPagesConfirmationResponse = {
    success: true,
    chapterId,
    updatedPages,
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
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
  const body: ClassifyPagesErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
