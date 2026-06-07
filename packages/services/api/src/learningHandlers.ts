/**
 * Learning Session API Handlers.
 *
 * Wires the learning session workflow (subject-first) to actual service logic.
 * Each handler extracts the learner ID from the JWT (sub claim) and delegates
 * to the learningSession service in @learnverse/service-core.
 */

import {
  startLearningSession,
  selectSubject,
  selectChapter,
  startNewChapter,
  endCurrentChapter,
  endLearningSession,
  getCurrentSession,
  enrollSubject,
  listEnrolledSubjects,
} from '@learnverse/service-core';

import type { ApiRequest, ApiResponse } from './endpoints';

// --- Helper: Extract learner ID from JWT ---

/**
 * Extracts the learner ID (sub claim) from the Authorization header.
 * In production this would verify the JWT signature; here we decode the payload.
 * Falls back to a header-based learner ID for simplified local dev.
 */
function extractLearnerId(req: ApiRequest): string | null {
  // Check for explicit learner ID header (local dev convenience)
  const learnerId = req.headers['x-learner-id'];
  if (learnerId) return learnerId;

  // Try to decode JWT sub claim from Bearer token
  const authHeader = req.headers['authorization'] ?? req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    // JWT is base64url encoded: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.sub ?? null;
  } catch {
    // If token isn't a valid JWT, use it directly as a learner identifier (dev mode)
    return token || null;
  }
}

/**
 * Helper to extract path parameters from a matched route.
 */
function extractPathParam(routePath: string, requestPath: string, paramName: string): string | null {
  const routeParts = routePath.split('/');
  const requestParts = requestPath.split('/');

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i] === `:${paramName}`) {
      return requestParts[i] ?? null;
    }
  }
  return null;
}

// --- Handlers ---

/**
 * POST /api/v1/learning/start
 *
 * Starts a new learning session. Returns the enrolled subjects
 * so the learner can select which one to study.
 */
export async function handleStartLearning(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const result = startLearningSession(learnerId);

  if (!result.success) {
    const status = result.error.code === 'NO_SUBJECTS_ENROLLED' ? 400 : 500;
    return {
      status: status as 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: result.error.code,
        message: result.error.message,
        retryable: false,
        suggestedAction: result.error.code === 'NO_SUBJECTS_ENROLLED'
          ? 'Enroll in a subject first using POST /api/v1/subjects/:subjectId/enroll'
          : undefined,
      },
    };
  }

  const session = result.value;
  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      step: session.currentStep,
      availableSubjects: session.availableSubjects,
      message: 'Please select a subject to begin learning.',
    },
  };
}

/**
 * POST /api/v1/learning/select-subject
 *
 * Body: { "subjectId": "english" }
 *
 * Selects a subject and returns the available chapters.
 */
export async function handleSelectSubject(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const body = req.body as { subjectId?: string } | undefined;
  if (!body?.subjectId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_FIELD',
        message: 'Please provide a subjectId in the request body.',
        field: 'subjectId',
        retryable: false,
      },
    };
  }

  const result = selectSubject(learnerId, body.subjectId);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      NO_ACTIVE_SESSION: 400,
      INVALID_STEP: 409,
      SUBJECT_NOT_ENROLLED: 404,
    };
    const status = (statusMap[result.error.code] ?? 400) as 400;
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  const session = result.value;
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      step: session.currentStep,
      selectedSubjectId: session.selectedSubjectId,
      availableChapters: session.availableChapters.map((ch) => ({
        id: ch.id,
        textbookName: ch.textbookName,
        chapterNumber: ch.chapterNumber,
        createdAt: ch.createdAt,
      })),
      message: session.availableChapters.length > 0
        ? 'Select a chapter or start a new one.'
        : 'No chapters yet. Start a new chapter to begin.',
    },
  };
}

/**
 * POST /api/v1/learning/select-chapter
 *
 * Body: { "chapterId": "ch-123" }
 *
 * Selects an existing chapter to continue learning.
 */
export async function handleSelectChapter(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const body = req.body as { chapterId?: string } | undefined;
  if (!body?.chapterId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_FIELD',
        message: 'Please provide a chapterId in the request body.',
        field: 'chapterId',
        retryable: false,
      },
    };
  }

  const result = selectChapter(learnerId, body.chapterId);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      NO_ACTIVE_SESSION: 400,
      INVALID_STEP: 409,
      CHAPTER_NOT_FOUND: 404,
    };
    const status = (statusMap[result.error.code] ?? 400) as 400;
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  const session = result.value;
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      step: session.currentStep,
      selectedSubjectId: session.selectedSubjectId,
      selectedChapterId: session.selectedChapterId,
    },
  };
}

/**
 * POST /api/v1/learning/new-chapter
 *
 * Signals intent to create a new chapter in the selected subject.
 * Advances the session to the learning step.
 */
export async function handleNewChapter(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const result = startNewChapter(learnerId);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      NO_ACTIVE_SESSION: 400,
      INVALID_STEP: 409,
    };
    const status = (statusMap[result.error.code] ?? 400) as 400;
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  const session = result.value;
  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      step: session.currentStep,
      selectedSubjectId: session.selectedSubjectId,
      message: 'New chapter started. Upload content to begin.',
    },
  };
}

/**
 * POST /api/v1/learning/end-chapter
 *
 * Ends the current chapter and returns to chapter selection.
 */
export async function handleEndChapter(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const result = endCurrentChapter(learnerId);

  if (!result.success) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  const session = result.value;
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      step: session.currentStep,
      selectedSubjectId: session.selectedSubjectId,
      availableChapters: session.availableChapters.map((ch) => ({
        id: ch.id,
        textbookName: ch.textbookName,
        chapterNumber: ch.chapterNumber,
      })),
    },
  };
}

/**
 * POST /api/v1/learning/end
 *
 * Ends the entire learning session.
 */
export async function handleEndLearning(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const result = endLearningSession(learnerId);

  if (!result.success) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { message: 'Learning session ended.' },
  };
}

/**
 * GET /api/v1/learning/session
 *
 * Returns the current learning session state, or null if no session is active.
 */
export async function handleGetSession(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const session = getCurrentSession(learnerId);

  if (!session) {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { session: null, message: 'No active learning session.' },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      session: {
        currentStep: session.currentStep,
        selectedSubjectId: session.selectedSubjectId,
        selectedChapterId: session.selectedChapterId,
        startedAt: session.startedAt,
        availableSubjects: session.availableSubjects,
        availableChapters: session.availableChapters.map((ch) => ({
          id: ch.id,
          textbookName: ch.textbookName,
          chapterNumber: ch.chapterNumber,
        })),
      },
    },
  };
}

/**
 * POST /api/v1/subjects/:subjectId/enroll
 *
 * Enrolls the learner in a subject.
 */
export async function handleEnrollSubject(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  // Extract subjectId from path: /api/v1/subjects/:subjectId/enroll
  const pathParts = req.path.split('/');
  // path is /api/v1/subjects/<subjectId>/enroll
  const subjectId = pathParts[4];
  if (!subjectId) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'MISSING_PARAM', message: 'Subject ID is required.', retryable: false },
    };
  }

  const result = enrollSubject(learnerId, subjectId);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      ALREADY_ENROLLED: 409,
      MAX_SUBJECTS_REACHED: 422,
    };
    const status = (statusMap[result.error.code] ?? 400) as 400;
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { code: result.error.code, message: result.error.message, retryable: false },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: `Enrolled successfully in "${subjectId}".`,
      enrolledSubjects: listEnrolledSubjects(learnerId),
    },
  };
}

/**
 * GET /api/v1/subjects
 *
 * Lists subjects the learner is enrolled in.
 */
export async function handleListSubjects(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'UNAUTHORIZED', message: 'Unable to identify learner', retryable: false },
    };
  }

  const subjects = listEnrolledSubjects(learnerId);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { data: subjects },
  };
}
