/**
 * Get Quiz Result Handler
 *
 * GET /quiz/sessions/:id/result
 *
 * Returns the quiz session result. If the session is still active,
 * checks whether the timer has expired or all questions have been answered,
 * and finalizes the session accordingly.
 *
 * Final score = (correct / total) × 100
 *
 * Requirements: 21.3, 21.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

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

export interface QuizResultResponse {
  sessionId: string;
  studentId: string;
  subjectId: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  skippedQuestions: number;
  scorePercentage: number;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt: string | null;
  timerDurationSeconds: number;
}

export interface GetQuizResultDbClient {
  getSession(sessionId: string): Promise<QuizSessionRecord | null>;
  getAnswers(sessionId: string): Promise<QuizAnswerRecord[]>;
  finalizeSession(params: {
    sessionId: string;
    correctAnswers: number;
    scorePercentage: number;
    endedAt: string;
    status: 'completed';
  }): Promise<void>;
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

// ============================================================
// Timer Check
// ============================================================

/**
 * Determines whether the quiz session timer has expired.
 */
export function isTimerExpired(startedAt: string, timerDurationSeconds: number): boolean {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsedSeconds = (now - startTime) / 1000;
  return elapsedSeconds >= timerDurationSeconds;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a getQuizResult Lambda handler with an injected database client.
 */
export function createGetQuizResultHandler(dbClient: GetQuizResultDbClient): LambdaHandler {
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

      const answers = await dbClient.getAnswers(sessionId);
      const answeredQuestions = answers.length;
      const correctAnswers = answers.filter(a => a.isCorrect).length;
      const skippedQuestions = answers.filter(a => a.selectedOption === null).length;

      let { status, endedAt, scorePercentage } = session;

      // Check if session should be finalized (Requirement 21.5)
      if (status === 'active') {
        const timerExpired = isTimerExpired(session.startedAt, session.timerDurationSeconds);
        const allQuestionsAnswered = answeredQuestions >= session.totalQuestions;

        if (timerExpired || allQuestionsAnswered) {
          // Final score: (correct / total) × 100 (Requirement 21.3)
          scorePercentage = session.totalQuestions > 0
            ? Math.round((correctAnswers / session.totalQuestions) * 100 * 100) / 100
            : 0;
          endedAt = new Date().toISOString();
          status = 'completed';

          await dbClient.finalizeSession({
            sessionId,
            correctAnswers,
            scorePercentage,
            endedAt,
            status: 'completed',
          });
        }
      }

      // For already completed sessions, use stored score or recalculate
      if (status === 'completed' && scorePercentage === null) {
        scorePercentage = session.totalQuestions > 0
          ? Math.round((correctAnswers / session.totalQuestions) * 100 * 100) / 100
          : 0;
      }

      const response: QuizResultResponse = {
        sessionId: session.id,
        studentId: session.studentId,
        subjectId: session.subjectId,
        totalQuestions: session.totalQuestions,
        answeredQuestions,
        correctAnswers,
        skippedQuestions,
        scorePercentage: scorePercentage ?? 0,
        status,
        startedAt: session.startedAt,
        endedAt: endedAt ?? null,
        timerDurationSeconds: session.timerDurationSeconds,
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
          message: 'An unexpected error occurred while retrieving quiz result',
        }),
      };
    }
  };
}
