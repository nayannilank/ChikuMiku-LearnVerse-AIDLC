/**
 * Revision API Handlers — Start sessions, submit answers, get summaries.
 *
 * Provides endpoints for the revision/assessment lifecycle backed by
 * the RevisionEngine in service-content-store.
 *
 * Requirements: 13.1, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3
 */

import {
  startRevisionSession,
  submitAnswer,
  getSessionSummary,
} from '@learnverse/service-content-store';
import type { SessionCompletedError } from '@learnverse/service-content-store';
import type { ApiRequest, ApiResponse } from './endpoints';

// --- Helper: Extract learner ID from JWT ---

function extractLearnerId(req: ApiRequest): string | null {
  const learnerId = req.headers['x-learner-id'];
  if (learnerId) return learnerId;

  const authHeader =
    req.headers['authorization'] ?? req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad === 2) base64 += '==';
    else if (pad === 3) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// --- Helper: Extract path parameter ---

/**
 * Extracts a named path parameter from the request path given a route pattern.
 * E.g., extractPathParam('/api/v1/revision/sessions/abc123/answers', '/api/v1/revision/sessions/:sessionId/answers', 'sessionId') => 'abc123'
 */
function extractPathParam(
  requestPath: string,
  routePattern: string,
  paramName: string
): string | null {
  const routeParts = routePattern.split('/');
  const requestParts = requestPath.split('/');

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i] === `:${paramName}`) {
      return requestParts[i] ?? null;
    }
  }
  return null;
}

// --- Helper: Check if result is a SessionCompletedError ---

function isSessionCompletedError(
  result: unknown
): result is SessionCompletedError {
  return (
    result !== null &&
    typeof result === 'object' &&
    'error' in (result as object) &&
    (result as SessionCompletedError).error === 'SESSION_COMPLETED'
  );
}

// --- Handlers ---

/**
 * POST /api/v1/revision/sessions
 *
 * Starts a new revision session for the authenticated learner on a chapter.
 * Generates 5-20 questions distributed across recall/understanding/application.
 *
 * Returns HTTP 201 with { sessionId, questionCount } on success.
 * Returns HTTP 400 if the chapter has insufficient content for question generation.
 *
 * Requirements: 13.1, 13.4
 */
export async function handleStartRevision(
  req: ApiRequest
): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Unable to identify learner',
        retryable: false,
      },
    };
  }

  const body = req.body as { chapterId?: string } | undefined;
  const chapterId = body?.chapterId;

  if (!chapterId || typeof chapterId !== 'string' || chapterId.trim() === '') {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'chapterId is required.',
        field: 'chapterId',
        retryable: false,
      },
    };
  }

  const session = startRevisionSession(learnerId, chapterId);

  if (!session) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INSUFFICIENT_CONTENT',
        message: 'Insufficient content to generate revision questions for this chapter.',
        retryable: false,
      },
    };
  }

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      sessionId: session.id,
      questionCount: session.questions.length,
    },
  };
}

/**
 * POST /api/v1/revision/sessions/:sessionId/answers
 *
 * Submits an answer for a question in an active revision session.
 * Returns the score (0-100), correctness (score >= 60), and feedback.
 *
 * Returns HTTP 404 if session or question not found.
 * Returns HTTP 400 if session is already completed.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
export async function handleSubmitAnswer(
  req: ApiRequest
): Promise<ApiResponse> {
  // Extract sessionId from path: /api/v1/revision/sessions/:sessionId/answers
  const sessionId = extractPathParam(
    req.path,
    '/api/v1/revision/sessions/:sessionId/answers',
    'sessionId'
  );

  if (!sessionId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_PARAM',
        message: 'Session ID is required.',
        retryable: false,
      },
    };
  }

  const body = req.body as
    | { questionId?: string; answer?: string }
    | undefined;
  const questionId = body?.questionId;
  const answer = body?.answer;

  if (!questionId || typeof questionId !== 'string') {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'questionId is required.',
        field: 'questionId',
        retryable: false,
      },
    };
  }

  if (answer === undefined || answer === null || typeof answer !== 'string') {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'answer is required.',
        field: 'answer',
        retryable: false,
      },
    };
  }

  const result = submitAnswer(sessionId, questionId, answer);

  // null means session or question not found
  if (result === null) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'NOT_FOUND',
        message: 'Session or question not found.',
        retryable: false,
      },
    };
  }

  // SessionCompletedError means the session is already finished
  if (isSessionCompletedError(result)) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'SESSION_COMPLETED',
        message: 'Session already completed',
        retryable: false,
      },
    };
  }

  // Success — return the scored answer
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      score: result.score,
      correct: result.score >= 60,
      feedback: result.feedback,
    },
  };
}

/**
 * GET /api/v1/revision/sessions/:sessionId/summary
 *
 * Returns the performance summary for a revision session.
 *
 * Returns HTTP 404 if session not found.
 *
 * Requirements: 15.1, 15.2, 15.3
 */
export async function handleGetRevisionSummary(
  req: ApiRequest
): Promise<ApiResponse> {
  // Extract sessionId from path: /api/v1/revision/sessions/:sessionId/summary
  const sessionId = extractPathParam(
    req.path,
    '/api/v1/revision/sessions/:sessionId/summary',
    'sessionId'
  );

  if (!sessionId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_PARAM',
        message: 'Session ID is required.',
        retryable: false,
      },
    };
  }

  const summary = getSessionSummary(sessionId);

  if (!summary) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'NOT_FOUND',
        message: 'Session not found.',
        retryable: false,
      },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: summary,
  };
}
