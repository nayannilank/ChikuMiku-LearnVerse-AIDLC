/**
 * Generate Revision Questions Handler
 *
 * POST /chapters/:id/revision-questions
 *
 * Generates MCQs, short answer, and fill-in-the-blank questions for a chapter
 * via GPT-5 Mini through the AI Gateway. Follows the generate-once-store-permanently
 * pattern: once generated, questions are stored and returned on subsequent requests.
 *
 * Requirements: 10.10, 10.12
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

/** A generated revision question */
export interface RevisionQuestion {
  id: string;
  chapterId: string;
  questionType: 'mcq' | 'short_answer' | 'fill_blank';
  questionText: string;
  options?: string[]; // for MCQ
  correctAnswer: string;
  explanation: string;
}

/** Success response from the generate handler */
export interface GenerateRevisionQuestionsSuccessResponse {
  success: true;
  chapterId: string;
  questions: RevisionQuestion[];
  cached: boolean;
}

/** Error response */
export interface GenerateRevisionQuestionsErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

/** AI Gateway client interface for generating revision questions */
export interface RevisionAiGatewayClient {
  process(request: AIGatewayRequest): Promise<AIGatewayResponse>;
}

/** Database client for chapter and cache operations */
export interface RevisionDbClient {
  chapterExists(chapterId: string): Promise<boolean>;
  getChapterContent(chapterId: string): Promise<string | null>;
  getRevisionQuestions(chapterId: string): Promise<RevisionQuestion[] | null>;
  saveRevisionQuestions(chapterId: string, questions: RevisionQuestion[]): Promise<void>;
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
 * Builds the deterministic cache key for revision questions.
 * Pattern: chapter:{chapterId}:revision-questions
 */
export function buildRevisionCacheKey(chapterId: string): string {
  return `chapter:${chapterId}:revision-questions`;
}

/**
 * Computes the SHA-256 hash of the request payload for cache validation.
 */
export function computeRevisionRequestHash(payload: Record<string, unknown>): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

/**
 * Generates a unique question ID.
 */
function generateQuestionId(chapterId: string, index: number): string {
  return `${chapterId}-rev-q-${index}`;
}

/**
 * Parses the AI Gateway response into structured RevisionQuestion objects.
 * Expects the response data to contain a `questions` array with the proper format.
 */
export function parseRevisionAiResponse(
  chapterId: string,
  data: Record<string, unknown>,
): RevisionQuestion[] {
  const rawQuestions = data.questions;

  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions.map((q: Record<string, unknown>, index: number) => {
    const question: RevisionQuestion = {
      id: generateQuestionId(chapterId, index),
      chapterId,
      questionType: validateQuestionType(q.questionType as string),
      questionText: String(q.questionText || ''),
      correctAnswer: String(q.correctAnswer || ''),
      explanation: String(q.explanation || ''),
    };

    if (question.questionType === 'mcq' && Array.isArray(q.options)) {
      question.options = q.options.map(String);
    }

    return question;
  });
}

/**
 * Validates and normalizes a question type string.
 */
function validateQuestionType(type: string): 'mcq' | 'short_answer' | 'fill_blank' {
  switch (type) {
    case 'mcq':
      return 'mcq';
    case 'short_answer':
      return 'short_answer';
    case 'fill_blank':
      return 'fill_blank';
    default:
      return 'short_answer';
  }
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a generateRevisionQuestions Lambda handler with injected dependencies.
 *
 * Flow:
 * 1. Validate chapter ID from path params
 * 2. Check if revision questions already exist (generate-once pattern)
 * 3. If cached, return stored questions
 * 4. Otherwise, get chapter content and call AI Gateway with serviceType 'revision'
 * 5. Parse AI response into RevisionQuestion objects
 * 6. Store questions permanently and return them
 */
export function createGenerateRevisionQuestionsHandler(
  aiGateway: RevisionAiGatewayClient,
  dbClient: RevisionDbClient,
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

      // Check if questions already exist (generate-once-store-permanently)
      const existingQuestions = await dbClient.getRevisionQuestions(chapterId);
      if (existingQuestions && existingQuestions.length > 0) {
        return successResponse(chapterId, existingQuestions, true);
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
      const cacheKey = buildRevisionCacheKey(chapterId);
      const payload: Record<string, unknown> = {
        chapterId,
        chapterContent,
        questionTypes: ['mcq', 'short_answer', 'fill_blank'],
        instruction:
          'Generate revision questions from the chapter content. Include a mix of MCQs (with 4 options), short answer questions, and fill-in-the-blank questions. Each question should have an explanation.',
      };

      const requestHash = computeRevisionRequestHash(payload);

      const aiRequest: AIGatewayRequest = {
        cacheKey,
        serviceType: 'revision',
        requestHash,
        payload,
      };

      // Call AI Gateway
      const aiResponse = await aiGateway.process(aiRequest);

      // Parse AI response into RevisionQuestion objects
      const questions = parseRevisionAiResponse(chapterId, aiResponse.data);

      if (questions.length === 0) {
        return errorResponse(
          500,
          'GENERATION_FAILED',
          'AI service returned no questions. Please try again.',
        );
      }

      // Store questions permanently
      await dbClient.saveRevisionQuestions(chapterId, questions);

      return successResponse(chapterId, questions, aiResponse.cached);
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while generating revision questions',
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
  cached: boolean,
): APIGatewayProxyResult {
  const body: GenerateRevisionQuestionsSuccessResponse = {
    success: true,
    chapterId,
    questions,
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
  const body: GenerateRevisionQuestionsErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
