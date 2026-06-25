/**
 * Submit Quiz Answer Handler
 *
 * POST /quiz/sessions/:id/answer
 *
 * Validates and records a student's answer to a quiz question.
 * Rejects duplicate submissions for the same question in the same session.
 * Updates the running score (correct / answered × 100).
 *
 * Requirements: 21.2, 21.4
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface SubmitAnswerRequest {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
}

export interface QuizSessionRecord {
  id: string;
  studentId: string;
  subjectId: string;
  questionIds: string[];
  timerDurationSeconds: number;
  startedAt: string;
  endedAt: string | null;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number | null;
  status: 'active' | 'completed' | 'abandoned';
}

export interface QuizAnswerRecord {
  sessionId: string;
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  isCorrect: boolean;
  answeredAt: string;
}

export interface ExerciseRecord {
  id: string;
  correctAnswer: Record<string, unknown>;
}

export interface SubmitAnswerResponse {
  sessionId: string;
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  runningScore: number;
  answeredCount: number;
  correctCount: number;
}

export interface SubmitAnswerDbClient {
  getSession(sessionId: string): Promise<QuizSessionRecord | null>;
  getAnswer(sessionId: string, questionId: string): Promise<QuizAnswerRecord | null>;
  getExercise(exerciseId: string): Promise<ExerciseRecord | null>;
  saveAnswer(params: {
    sessionId: string;
    questionId: string;
    selectedOption: 'A' | 'B' | 'C' | 'D';
    isCorrect: boolean;
  }): Promise<void>;
  updateSessionScore(params: {
    sessionId: string;
    correctAnswers: number;
    scorePercentage: number;
  }): Promise<void>;
  getAnsweredCount(sessionId: string): Promise<number>;
  getCorrectCount(sessionId: string): Promise<number>;
}

// ============================================================
// CORS Headers
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D']);

function validateRequest(body: unknown): { valid: true; data: SubmitAnswerRequest } | { valid: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body is required' };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.questionId || typeof obj.questionId !== 'string' || !isValidUUID(obj.questionId)) {
    return { valid: false, message: 'questionId must be a valid UUID' };
  }

  if (!obj.selectedOption || typeof obj.selectedOption !== 'string' || !VALID_OPTIONS.has(obj.selectedOption)) {
    return { valid: false, message: 'selectedOption must be one of A, B, C, D' };
  }

  return {
    valid: true,
    data: {
      questionId: obj.questionId,
      selectedOption: obj.selectedOption as 'A' | 'B' | 'C' | 'D',
    },
  };
}

// ============================================================
// Answer Evaluation
// ============================================================

/**
 * Evaluates whether the selected option is correct by comparing against
 * the exercise's correctAnswer field. Supports common patterns:
 * - { option: "A" }
 * - { answer: "B" }
 * - { correctOption: "C" }
 */
export function evaluateAnswer(
  selectedOption: string,
  correctAnswer: Record<string, unknown>,
): boolean {
  const correct =
    correctAnswer.option ?? correctAnswer.answer ?? correctAnswer.correctOption;
  if (typeof correct === 'string') {
    return correct.toUpperCase() === selectedOption.toUpperCase();
  }
  return false;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a submitQuizAnswer Lambda handler with an injected database client.
 */
export function createSubmitQuizAnswerHandler(dbClient: SubmitAnswerDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const sessionId = event.pathParameters?.id;

      if (!sessionId || !isValidUUID(sessionId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Session ID must be a valid UUID',
          }),
        };
      }

      if (!event.body) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_REQUEST',
            message: 'Request body is required',
          }),
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      const validation = validateRequest(parsed);
      if (!validation.valid) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: validation.message,
          }),
        };
      }

      const { questionId, selectedOption } = validation.data;

      // Verify session exists and is active
      const session = await dbClient.getSession(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'NOT_FOUND',
            message: 'Quiz session not found',
          }),
        };
      }

      if (session.status !== 'active') {
        return {
          statusCode: 409,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 409,
            errorCode: 'SESSION_NOT_ACTIVE',
            message: 'Quiz session is no longer active',
          }),
        };
      }

      // Verify question belongs to this session
      if (!session.questionIds.includes(questionId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_QUESTION',
            message: 'Question does not belong to this quiz session',
          }),
        };
      }

      // Check for duplicate answer (Requirement 21.4)
      const existingAnswer = await dbClient.getAnswer(sessionId, questionId);
      if (existingAnswer) {
        return {
          statusCode: 409,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 409,
            errorCode: 'DUPLICATE_ANSWER',
            message: 'Answer already submitted for this question in this session',
          }),
        };
      }

      // Get the exercise to evaluate correctness
      const exercise = await dbClient.getExercise(questionId);
      if (!exercise) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'EXERCISE_NOT_FOUND',
            message: 'Exercise not found for the given question',
          }),
        };
      }

      // Evaluate the answer
      const isCorrect = evaluateAnswer(selectedOption, exercise.correctAnswer);

      // Save the answer
      await dbClient.saveAnswer({
        sessionId,
        questionId,
        selectedOption,
        isCorrect,
      });

      // Get updated counts for running score
      const answeredCount = await dbClient.getAnsweredCount(sessionId);
      const correctCount = await dbClient.getCorrectCount(sessionId);

      // Running score: (correct / answered) × 100 (Requirement 21.2)
      const runningScore = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100 * 100) / 100 : 0;

      // Update session score
      await dbClient.updateSessionScore({
        sessionId,
        correctAnswers: correctCount,
        scorePercentage: runningScore,
      });

      const response: SubmitAnswerResponse = {
        sessionId,
        questionId,
        selectedOption,
        isCorrect,
        runningScore,
        answeredCount,
        correctCount,
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while submitting quiz answer',
        }),
      };
    }
  };
}
