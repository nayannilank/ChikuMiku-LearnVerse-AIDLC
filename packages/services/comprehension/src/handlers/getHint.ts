/**
 * Get Hint Handler
 *
 * POST /exercises/:id/hint
 *
 * Provides contextual hints for exercises using RAG (Retrieval-Augmented Generation):
 * 1. Accepts question text from the student
 * 2. Retrieves exercise details to find the associated chapter
 * 3. Embeds the question text using text-embedding-3-small (via AI Gateway)
 * 4. Performs pgvector similarity search: retrieves top 5 paragraphs from chapter_embeddings
 * 5. Sends context + question to GPT-5 Mini to generate a hint without revealing the answer
 * 6. Returns the hint and referenced chapter sections
 *
 * Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface HintRequest {
  questionText: string;
}

export interface ReferencedSection {
  pageNumber: number;
  paragraphIndex: number;
  textSnippet: string;
  similarity: number;
}

export interface GetHintSuccessResponse {
  success: true;
  hint: string;
  referencedSections: ReferencedSection[];
  cached: boolean;
}

export interface GetHintErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

/** Embedding vector result from AI Gateway */
export interface EmbeddingResponse {
  cached: boolean;
  data: {
    embedding?: number[];
    [key: string]: unknown;
  };
}

/** Text generation result from AI Gateway */
export interface TextGenerationResponse {
  cached: boolean;
  data: {
    text?: string;
    [key: string]: unknown;
  };
}

/** A paragraph retrieved via similarity search */
export interface SimilarParagraph {
  pageNumber: number;
  paragraphIndex: number;
  textContent: string;
  similarity: number;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface HintAIGatewayClient {
  /** Processes an embedding request through the AI Gateway */
  process(request: {
    cacheKey: string;
    serviceType: 'embedding';
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<EmbeddingResponse>;

  /** Processes a text generation request through the AI Gateway */
  process(request: {
    cacheKey: string;
    serviceType: 'text_generation';
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<TextGenerationResponse>;

  process(request: {
    cacheKey: string;
    serviceType: string;
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<EmbeddingResponse | TextGenerationResponse>;
}

export interface HintDbClient {
  /** Gets exercise details including the associated chapter ID */
  getExerciseInfo(exerciseId: string): Promise<{
    id: string;
    chapterId: string;
    questionText: string;
    correctAnswer: string;
    exerciseType: string;
    gradeLevel?: string;
  } | null>;

  /** Performs pgvector similarity search on chapter_embeddings */
  findSimilarParagraphs(
    chapterId: string,
    embedding: number[],
    limit: number,
  ): Promise<SimilarParagraph[]>;
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

const TOP_K_PARAGRAPHS = 5;

const HINT_PROMPT_INSTRUCTION =
  'You are a helpful educational assistant. A student is working on an exercise from their textbook. ' +
  'Using ONLY the provided chapter context, give the student a helpful hint that guides them toward ' +
  'the answer WITHOUT revealing the full answer. Be encouraging and age-appropriate. ' +
  'Reference which part of the chapter content is most relevant. ' +
  'Return JSON with fields: hint (string — the contextual hint for the student).';

// ============================================================
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Builds a deterministic cache key for an embedding request.
 */
export function buildEmbeddingCacheKey(text: string): string {
  const normalized = text.trim().toLowerCase().slice(0, 100);
  return `embedding:hint:${computeSimpleHash(normalized)}`;
}

/**
 * Builds a deterministic cache key for a hint generation request.
 */
export function buildHintCacheKey(exerciseId: string, questionText: string): string {
  const normalized = questionText.trim().toLowerCase().slice(0, 100);
  return `exercise:${exerciseId}:hint:${computeSimpleHash(normalized)}`;
}

/**
 * Computes a simple hash of a string for cache key generation.
 */
export function computeSimpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getHint Lambda handler with injected dependencies.
 *
 * POST /exercises/:id/hint
 * Body: { questionText: string }
 *
 * Flow:
 * 1. Validate exercise ID and request body
 * 2. Get exercise details (to find chapter ID)
 * 3. Embed the question text using text-embedding-3-small
 * 4. Perform pgvector similarity search — top 5 paragraphs
 * 5. Generate hint using GPT-5 Mini with retrieved context
 * 6. Return hint and referenced sections
 */
export function createGetHintHandler(
  aiGateway: HintAIGatewayClient,
  dbClient: HintDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract exercise ID from path parameters
      const exerciseId = event.pathParameters?.id;

      if (!exerciseId || !isValidUUID(exerciseId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid exercise ID');
      }

      // Parse request body
      if (!event.body) {
        return errorResponse(400, 'MISSING_BODY', 'Request body is required');
      }

      let requestBody: HintRequest;
      try {
        requestBody = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      if (!requestBody.questionText || requestBody.questionText.trim().length === 0) {
        return errorResponse(400, 'MISSING_FIELD', 'questionText is required and cannot be empty');
      }

      const questionText = requestBody.questionText.trim();

      // Get exercise details
      const exercise = await dbClient.getExerciseInfo(exerciseId);

      if (!exercise) {
        return errorResponse(404, 'EXERCISE_NOT_FOUND', `Exercise ${exerciseId} not found`);
      }

      // Step 1: Embed the question text
      const embeddingCacheKey = buildEmbeddingCacheKey(questionText);
      const embeddingResponse = await aiGateway.process({
        cacheKey: embeddingCacheKey,
        serviceType: 'embedding',
        requestHash: computeSimpleHash(questionText),
        payload: {
          text: questionText,
          model: 'text-embedding-3-small',
        },
      });

      const embedding = embeddingResponse.data.embedding;
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        return errorResponse(
          500,
          'EMBEDDING_FAILED',
          'Failed to generate embedding for question text',
        );
      }

      // Step 2: Perform pgvector similarity search
      const similarParagraphs = await dbClient.findSimilarParagraphs(
        exercise.chapterId,
        embedding,
        TOP_K_PARAGRAPHS,
      );

      // Step 3: Generate hint with GPT-5 Mini
      const contextText = similarParagraphs
        .map(
          (p, i) =>
            `[Section ${i + 1} - Page ${p.pageNumber}, Paragraph ${p.paragraphIndex}]: ${p.textContent}`,
        )
        .join('\n\n');

      const hintCacheKey = buildHintCacheKey(exerciseId, questionText);
      const hintResponse = await aiGateway.process({
        cacheKey: hintCacheKey,
        serviceType: 'text_generation',
        requestHash: computeSimpleHash(`${exerciseId}:${questionText}:${contextText.length}`),
        payload: {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: HINT_PROMPT_INSTRUCTION },
            {
              role: 'user',
              content:
                `Question: ${questionText}\n\n` +
                `Chapter Context:\n${contextText}\n\n` +
                `Provide a helpful hint without revealing the full answer.`,
            },
          ],
        },
      });

      // Parse the hint from the AI response
      const hint = parseHintResponse(hintResponse.data);

      // Build referenced sections
      const referencedSections: ReferencedSection[] = similarParagraphs.map((p) => ({
        pageNumber: p.pageNumber,
        paragraphIndex: p.paragraphIndex,
        textSnippet: p.textContent.slice(0, 150) + (p.textContent.length > 150 ? '...' : ''),
        similarity: p.similarity,
      }));

      const response: GetHintSuccessResponse = {
        success: true,
        hint,
        referencedSections,
        cached: hintResponse.cached,
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
        'An unexpected error occurred while generating the hint',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

/**
 * Parses the hint text from the AI Gateway response data.
 */
export function parseHintResponse(data: Record<string, unknown>): string {
  // Try direct text field
  if (typeof data.text === 'string' && data.text.trim().length > 0) {
    // Try to parse as JSON if it looks like JSON
    try {
      const parsed = JSON.parse(data.text);
      if (typeof parsed.hint === 'string') {
        return parsed.hint;
      }
    } catch {
      // Not JSON, return as plain text
      return data.text.trim();
    }
    return data.text.trim();
  }

  // Try hint field directly on data
  if (typeof data.hint === 'string' && data.hint.trim().length > 0) {
    return data.hint.trim();
  }

  return 'Please review the chapter content related to this question for more guidance.';
}

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: GetHintErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
