/**
 * Evaluate Handler
 *
 * POST /exercises/:id/evaluate
 *
 * Grades a student's answer using RAG + GPT-5 Mini:
 * 1. Accepts the student's answer
 * 2. Gets exercise details (correct answer, chapter context)
 * 3. Embeds the question for context retrieval (top 5 paragraphs from RAG)
 * 4. Sends answer + correct answer + context to GPT-5 Mini for grading
 * 5. GPT-5 Mini acts as a grade-appropriate teacher: provides feedback
 * 6. For incorrect answers: references the relevant chapter section
 * 7. Returns { isCorrect, score, feedback, referencedSection? }
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

export interface EvaluateRequest {
  answer: string;
}

export interface ReferencedSection {
  pageNumber: number;
  paragraphIndex: number;
  textSnippet: string;
  similarity: number;
}

export interface EvaluateSuccessResponse {
  success: true;
  isCorrect: boolean;
  score: number;
  feedback: string;
  referencedSection?: ReferencedSection;
  cached: boolean;
}

export interface EvaluateErrorResponse {
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
    isCorrect?: boolean;
    score?: number;
    feedback?: string;
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

export interface EvaluateAIGatewayClient {
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

export interface EvaluateDbClient {
  /** Gets exercise details including the associated chapter ID and correct answer */
  getExerciseInfo(exerciseId: string): Promise<{
    id: string;
    chapterId: string;
    questionText: string;
    correctAnswer: string;
    exerciseType: string;
    gradeLevel?: string;
    subject?: string;
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

/**
 * Builds the evaluation prompt instruction.
 * Uses grade level if available for grade-appropriate feedback.
 */
function buildEvaluationPrompt(gradeLevel?: string, subject?: string): string {
  const gradeContext = gradeLevel
    ? `You are grading as a ${gradeLevel} teacher. `
    : 'You are grading as an elementary school teacher. ';
  const subjectContext = subject ? `The subject is ${subject}. ` : '';

  return (
    gradeContext +
    subjectContext +
    'Evaluate the student answer against the correct answer. ' +
    'Use the provided chapter context to give helpful, encouraging feedback. ' +
    'If the answer is incorrect, reference which section of the chapter the student should review. ' +
    'Return JSON with fields: isCorrect (boolean), score (number 0-100), feedback (string — ' +
    'age-appropriate explanation), referencedSectionIndex (number | null — 0-based index of the ' +
    'most relevant context section if the answer is incorrect).'
  );
}

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
  return `embedding:evaluate:${computeSimpleHash(normalized)}`;
}

/**
 * Builds a deterministic cache key for an evaluation request.
 */
export function buildEvaluateCacheKey(exerciseId: string, answer: string): string {
  const normalized = answer.trim().toLowerCase().slice(0, 100);
  return `exercise:${exerciseId}:evaluate:${computeSimpleHash(normalized)}`;
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
 * Creates an evaluate Lambda handler with injected dependencies.
 *
 * POST /exercises/:id/evaluate
 * Body: { answer: string }
 *
 * Flow:
 * 1. Validate exercise ID and request body
 * 2. Get exercise details (correct answer, chapter ID, grade level)
 * 3. Embed the question text for context retrieval
 * 4. Perform pgvector similarity search — top 5 paragraphs
 * 5. Grade using GPT-5 Mini as a grade-appropriate teacher
 * 6. For incorrect answers: reference relevant chapter section
 * 7. Return evaluation result
 */
export function createEvaluateHandler(
  aiGateway: EvaluateAIGatewayClient,
  dbClient: EvaluateDbClient,
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

      let requestBody: EvaluateRequest;
      try {
        requestBody = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      if (!requestBody.answer || requestBody.answer.trim().length === 0) {
        return errorResponse(400, 'MISSING_FIELD', 'answer is required and cannot be empty');
      }

      const studentAnswer = requestBody.answer.trim();

      // Get exercise details
      const exercise = await dbClient.getExerciseInfo(exerciseId);

      if (!exercise) {
        return errorResponse(404, 'EXERCISE_NOT_FOUND', `Exercise ${exerciseId} not found`);
      }

      // Step 1: Embed the question text for context retrieval
      const embeddingCacheKey = buildEmbeddingCacheKey(exercise.questionText);
      const embeddingResponse = await aiGateway.process({
        cacheKey: embeddingCacheKey,
        serviceType: 'embedding',
        requestHash: computeSimpleHash(exercise.questionText),
        payload: {
          text: exercise.questionText,
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

      // Step 3: Grade with GPT-5 Mini
      const contextText = similarParagraphs
        .map(
          (p, i) =>
            `[Section ${i + 1} - Page ${p.pageNumber}, Paragraph ${p.paragraphIndex}]: ${p.textContent}`,
        )
        .join('\n\n');

      const evaluateCacheKey = buildEvaluateCacheKey(exerciseId, studentAnswer);
      const evaluationPrompt = buildEvaluationPrompt(exercise.gradeLevel, exercise.subject);

      const evaluationResponse = await aiGateway.process({
        cacheKey: evaluateCacheKey,
        serviceType: 'text_generation',
        requestHash: computeSimpleHash(
          `${exerciseId}:${studentAnswer}:${exercise.correctAnswer}:${contextText.length}`,
        ),
        payload: {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: evaluationPrompt },
            {
              role: 'user',
              content:
                `Question: ${exercise.questionText}\n\n` +
                `Correct Answer: ${exercise.correctAnswer}\n\n` +
                `Student's Answer: ${studentAnswer}\n\n` +
                `Chapter Context:\n${contextText}\n\n` +
                `Evaluate the student's answer and provide grade-appropriate feedback.`,
            },
          ],
        },
      });

      // Parse the evaluation result
      const evaluation = parseEvaluationResponse(evaluationResponse.data, similarParagraphs);

      const response: EvaluateSuccessResponse = {
        success: true,
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        feedback: evaluation.feedback,
        referencedSection: evaluation.referencedSection,
        cached: evaluationResponse.cached,
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
        'An unexpected error occurred while evaluating the answer',
      );
    }
  };
}

// ============================================================
// Response Parsing
// ============================================================

interface ParsedEvaluation {
  isCorrect: boolean;
  score: number;
  feedback: string;
  referencedSection?: ReferencedSection;
}

/**
 * Parses the evaluation result from the AI Gateway response data.
 */
export function parseEvaluationResponse(
  data: Record<string, unknown>,
  similarParagraphs: SimilarParagraph[],
): ParsedEvaluation {
  let isCorrect = false;
  let score = 0;
  let feedback = 'Unable to evaluate the answer. Please try again.';
  let referencedSectionIndex: number | null = null;

  // Try parsing from text field (if AI returns JSON as a string)
  if (typeof data.text === 'string' && data.text.trim().length > 0) {
    try {
      const parsed = JSON.parse(data.text);
      if (typeof parsed.isCorrect === 'boolean') isCorrect = parsed.isCorrect;
      if (typeof parsed.score === 'number') score = clampScore(parsed.score);
      if (typeof parsed.feedback === 'string') feedback = parsed.feedback;
      if (typeof parsed.referencedSectionIndex === 'number') {
        referencedSectionIndex = parsed.referencedSectionIndex;
      }
    } catch {
      // Not JSON, use as plain feedback
      feedback = data.text.trim();
    }
  } else {
    // Try direct fields on data object
    if (typeof data.isCorrect === 'boolean') isCorrect = data.isCorrect;
    if (typeof data.score === 'number') score = clampScore(data.score);
    if (typeof data.feedback === 'string') feedback = data.feedback;
    if (typeof data.referencedSectionIndex === 'number') {
      referencedSectionIndex = data.referencedSectionIndex;
    }
  }

  // Build referenced section for incorrect answers
  let referencedSection: ReferencedSection | undefined;
  if (!isCorrect && similarParagraphs.length > 0) {
    const sectionIdx =
      referencedSectionIndex !== null &&
      referencedSectionIndex >= 0 &&
      referencedSectionIndex < similarParagraphs.length
        ? referencedSectionIndex
        : 0; // Default to most relevant paragraph

    const paragraph = similarParagraphs[sectionIdx];
    referencedSection = {
      pageNumber: paragraph.pageNumber,
      paragraphIndex: paragraph.paragraphIndex,
      textSnippet:
        paragraph.textContent.slice(0, 150) +
        (paragraph.textContent.length > 150 ? '...' : ''),
      similarity: paragraph.similarity,
    };
  }

  return { isCorrect, score, feedback, referencedSection };
}

/**
 * Clamps a score value between 0 and 100.
 */
function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: EvaluateErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
