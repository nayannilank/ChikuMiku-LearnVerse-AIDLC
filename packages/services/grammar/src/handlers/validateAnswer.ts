/**
 * Validate Answer Handler
 *
 * POST /grammar/exercises/:id/validate
 *
 * Validates a student's grammar exercise answer:
 * 1. Accepts the selected answer option
 * 2. Fetches the exercise from the database (type='grammar', content JSONB, correct_answer JSONB)
 * 3. Compares the selected answer against the correct solution
 * 4. If correct: returns green success indicator with brief confirmation
 * 5. If incorrect: generates explanatory feedback via GPT-5 Mini referencing the grammar rule
 * 6. Returns { isCorrect, correctAnswer, feedback, grammarRule }
 *
 * Requirements: 13.5, 13.6, 13.7
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface ValidateAnswerRequest {
  /** The answer option selected by the student */
  selectedAnswer: string;
}

export interface GrammarExerciseContent {
  /** The sentence with a blank to fill */
  sentence: string;
  /** The answer options presented to the student */
  options: string[];
  /** The grammar rule being tested (e.g., "subject-verb agreement") */
  grammarRule: string;
  /** Optional context/instruction for the exercise */
  instruction?: string;
}

export interface GrammarCorrectAnswer {
  /** The correct answer string */
  answer: string;
  /** Index of the correct option in the options array */
  optionIndex: number;
}

export interface ValidateAnswerSuccessResponse {
  success: true;
  isCorrect: boolean;
  correctAnswer: string;
  feedback: string;
  grammarRule: string;
  cached: boolean;
}

export interface ValidateAnswerErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

/** Text generation result from AI Gateway */
export interface TextGenerationResponse {
  cached: boolean;
  data: {
    text?: string;
    feedback?: string;
    [key: string]: unknown;
  };
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface ValidateAnswerAIGatewayClient {
  /** Processes a text generation request through the AI Gateway for feedback */
  process(request: {
    cacheKey: string;
    serviceType: 'text_generation';
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<TextGenerationResponse>;
}

export interface ValidateAnswerDbClient {
  /** Gets a grammar exercise by ID, including content and correct answer */
  getGrammarExercise(exerciseId: string): Promise<{
    id: string;
    subjectId: string;
    chapterId?: string;
    exerciseType: string;
    content: GrammarExerciseContent;
    correctAnswer: GrammarCorrectAnswer;
    explanation?: string;
  } | null>;
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

/**
 * Builds a deterministic cache key for grammar feedback generation.
 */
export function buildFeedbackCacheKey(exerciseId: string, selectedAnswer: string): string {
  const normalized = selectedAnswer.trim().toLowerCase();
  return `grammar:${exerciseId}:feedback:${computeSimpleHash(normalized)}`;
}

/**
 * Builds the prompt for GPT-5 Mini to generate explanatory feedback
 * that references the grammar rule being tested.
 */
function buildFeedbackPrompt(grammarRule: string): string {
  return (
    'You are a helpful, encouraging English grammar teacher for school children. ' +
    `The grammar rule being tested is: "${grammarRule}". ` +
    'The student selected an incorrect answer for a fill-in-the-blank grammar exercise. ' +
    'Provide a brief, clear explanation of why the correct answer is right, ' +
    'referencing the grammar rule being tested. ' +
    'Keep the explanation age-appropriate, encouraging, and under 2-3 sentences. ' +
    'Return JSON with a single field: feedback (string).'
  );
}

/**
 * Generates a brief success confirmation message for correct answers.
 */
function buildSuccessFeedback(correctAnswer: string, grammarRule: string): string {
  return `Correct! "${correctAnswer}" is the right answer. You've demonstrated good understanding of ${grammarRule}.`;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a validateAnswer Lambda handler with injected dependencies.
 *
 * POST /grammar/exercises/:id/validate
 * Body: { selectedAnswer: string }
 *
 * Flow:
 * 1. Validate exercise ID and request body
 * 2. Fetch grammar exercise from database
 * 3. Compare selected answer against correct answer
 * 4. If correct: return success feedback with grammar rule confirmation
 * 5. If incorrect: call GPT-5 Mini via AI Gateway for explanatory feedback
 * 6. Return validation result
 */
export function createValidateAnswerHandler(
  aiGateway: ValidateAnswerAIGatewayClient,
  dbClient: ValidateAnswerDbClient,
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

      let requestBody: ValidateAnswerRequest;
      try {
        requestBody = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      if (
        !requestBody.selectedAnswer ||
        typeof requestBody.selectedAnswer !== 'string' ||
        requestBody.selectedAnswer.trim().length === 0
      ) {
        return errorResponse(
          400,
          'MISSING_FIELD',
          'selectedAnswer is required and cannot be empty',
        );
      }

      const selectedAnswer = requestBody.selectedAnswer.trim();

      // Fetch grammar exercise from database
      const exercise = await dbClient.getGrammarExercise(exerciseId);

      if (!exercise) {
        return errorResponse(404, 'EXERCISE_NOT_FOUND', `Exercise ${exerciseId} not found`);
      }

      if (exercise.exerciseType !== 'grammar') {
        return errorResponse(
          400,
          'INVALID_EXERCISE_TYPE',
          `Exercise ${exerciseId} is not a grammar exercise`,
        );
      }

      const { content, correctAnswer } = exercise;
      const grammarRule = content.grammarRule;
      const isCorrect =
        selectedAnswer.toLowerCase() === correctAnswer.answer.toLowerCase();

      // If correct: return success confirmation (Requirement 13.5)
      if (isCorrect) {
        const feedback = buildSuccessFeedback(correctAnswer.answer, grammarRule);
        const response: ValidateAnswerSuccessResponse = {
          success: true,
          isCorrect: true,
          correctAnswer: correctAnswer.answer,
          feedback,
          grammarRule,
          cached: false,
        };

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(response),
        };
      }

      // If incorrect: generate explanatory feedback via GPT-5 Mini (Requirements 13.6, 13.7)
      const cacheKey = buildFeedbackCacheKey(exerciseId, selectedAnswer);
      const feedbackPrompt = buildFeedbackPrompt(grammarRule);

      const aiResponse = await aiGateway.process({
        cacheKey,
        serviceType: 'text_generation',
        requestHash: computeSimpleHash(
          `${exerciseId}:${selectedAnswer}:${correctAnswer.answer}:${grammarRule}`,
        ),
        payload: {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: feedbackPrompt },
            {
              role: 'user',
              content:
                `Sentence: "${content.sentence}"\n` +
                `Student selected: "${selectedAnswer}"\n` +
                `Correct answer: "${correctAnswer.answer}"\n` +
                `Grammar rule: "${grammarRule}"\n\n` +
                'Explain why the correct answer is right, referencing the grammar rule.',
            },
          ],
        },
      });

      // Parse AI response for feedback
      const feedback = parseFeedbackResponse(aiResponse.data, correctAnswer.answer, grammarRule);

      const response: ValidateAnswerSuccessResponse = {
        success: true,
        isCorrect: false,
        correctAnswer: correctAnswer.answer,
        feedback,
        grammarRule,
        cached: aiResponse.cached,
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
        'An unexpected error occurred while validating the answer',
      );
    }
  };
}

// ============================================================
// Response Parsing
// ============================================================

/**
 * Parses the feedback from the AI Gateway response.
 * Falls back to a generic explanation if parsing fails.
 */
export function parseFeedbackResponse(
  data: Record<string, unknown>,
  correctAnswer: string,
  grammarRule: string,
): string {
  // Try parsing from text field (AI may return JSON string)
  if (typeof data.text === 'string' && data.text.trim().length > 0) {
    try {
      const parsed = JSON.parse(data.text);
      if (typeof parsed.feedback === 'string' && parsed.feedback.trim().length > 0) {
        return parsed.feedback;
      }
    } catch {
      // Not JSON — use the text directly as feedback
      return data.text.trim();
    }
  }

  // Try direct feedback field on data object
  if (typeof data.feedback === 'string' && data.feedback.trim().length > 0) {
    return data.feedback;
  }

  // Fallback: generic explanation referencing the grammar rule
  return (
    `The correct answer is "${correctAnswer}". ` +
    `This question tests the grammar rule: ${grammarRule}. ` +
    `Review this rule to understand why the correct answer applies here.`
  );
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: ValidateAnswerErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
