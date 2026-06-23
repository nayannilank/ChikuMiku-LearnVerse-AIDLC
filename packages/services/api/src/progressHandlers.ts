/**
 * Progress API Handlers — Get and Update learner progress.
 *
 * Provides endpoints for reading a learner's progress summary (including
 * weak activity identification) and recording activity scores with
 * recalculated completion percentages.
 *
 * Requirements: 11.1, 11.2, 12.1, 12.2, 12.3, 12.4
 */

import { ContentStore } from '@learnverse/service-content-store';
import type { ActivityType } from '@learnverse/service-core';
import type { ApiRequest, ApiResponse } from './endpoints';

// --- Shared ContentStore instance ---

const contentStore = new ContentStore();

/**
 * Get the shared content store instance (for testing).
 */
export function getProgressContentStore(): ContentStore {
  return contentStore;
}

// --- Valid activity types ---

const VALID_ACTIVITY_TYPES: ActivityType[] = [
  'comprehension',
  'pronunciation',
  'grammar',
  'revision',
];

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

// --- Handlers ---

/**
 * GET /api/v1/progress
 *
 * Returns the authenticated learner's progress records, including
 * completion percentages, activity scores, and weak activity identification
 * (activities scoring below 60%).
 *
 * Returns an empty progress object with zero completion when no records exist.
 *
 * Requirements: 11.1, 11.2, 12.4 (completion recalculation reflected in read)
 */
export async function handleGetProgress(req: ApiRequest): Promise<ApiResponse> {
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

  const progress = contentStore.getProgress(learnerId);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: progress,
  };
}

/**
 * POST /api/v1/progress
 *
 * Validates the request body (chapterId, activityType, score 0-100),
 * persists the progress update via ContentStore.trackProgress(), and
 * returns the updated progress summary with recalculated completion percentage.
 *
 * Returns HTTP 400 with validation errors for missing/invalid fields.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
export async function handleUpdateProgress(
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

  const body = req.body as
    | {
        chapterId?: string;
        activityType?: string;
        score?: number;
        subjectId?: string;
      }
    | undefined;

  // Validate required fields
  const errors: Array<{ field: string; message: string }> = [];

  const chapterId = body?.chapterId;
  if (!chapterId || typeof chapterId !== 'string' || chapterId.trim() === '') {
    errors.push({
      field: 'chapterId',
      message: 'chapterId is required.',
    });
  }

  const activityType = body?.activityType;
  if (!activityType || typeof activityType !== 'string') {
    errors.push({
      field: 'activityType',
      message: 'activityType is required.',
    });
  } else if (!VALID_ACTIVITY_TYPES.includes(activityType as ActivityType)) {
    errors.push({
      field: 'activityType',
      message: `activityType must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}.`,
    });
  }

  const score = body?.score;
  if (score === undefined || score === null) {
    errors.push({
      field: 'score',
      message: 'score is required.',
    });
  } else if (typeof score !== 'number' || !Number.isFinite(score)) {
    errors.push({
      field: 'score',
      message: 'score must be a number.',
    });
  } else if (score < 0 || score > 100) {
    errors.push({
      field: 'score',
      message: 'score must be between 0 and 100.',
    });
  }

  if (errors.length > 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        errors,
        retryable: false,
      },
    };
  }

  // Use a default subjectId if not provided — in a real app this would
  // be looked up from the chapter record. For now we use 'default'.
  const subjectId = body?.subjectId || 'default';

  // Persist the progress update
  contentStore.trackProgress(learnerId, chapterId!, subjectId, {
    activityType: activityType as ActivityType,
    score: score!,
    completedAt: new Date(),
  });

  // Return updated progress summary
  const updatedProgress = contentStore.getProgress(learnerId);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: updatedProgress,
  };
}
