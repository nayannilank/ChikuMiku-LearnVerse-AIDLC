/**
 * Edit Learner Subjects Lambda Handler
 *
 * Allows an authenticated parent to update the subject assignments for one of their learners.
 * Enforces minimum 1 subject constraint and parent ownership validation.
 *
 * PUT /parent/learners/:id/subjects
 *
 * Requirements: 22.4, 22.6, 22.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaHandler } from '@learnverse/service-core';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface LearnerRecord {
  id: string;
  parentId: string;
  name: string;
  grade: string;
}

export interface SubjectRecord {
  id: string;
  name: string;
  color: string;
}

export interface EditLearnerSubjectsDbClient {
  getLearnerById(learnerId: string): Promise<LearnerRecord | null>;
  updateLearnerSubjects(learnerId: string, subjectIds: string[]): Promise<SubjectRecord[]>;
}

// ============================================================
// Types
// ============================================================

export interface EditLearnerSubjectsRequestBody {
  subjectIds: string[];
}

export interface EditLearnerSubjectsSuccessResponse {
  success: true;
  subjects: SubjectRecord[];
}

export interface EditLearnerSubjectsErrorResponse {
  success: false;
  errorCode: string;
  message: string;
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
// Handler Factory
// ============================================================

/**
 * Creates an editLearnerSubjects Lambda handler with injected DB client dependency.
 */
export function createEditLearnerSubjectsHandler(dbClient: EditLearnerSubjectsDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract parentId from JWT claims
      const parentId = event.requestContext?.authorizer?.claims?.sub;

      if (!parentId) {
        return errorResponse(401, 'Authentication required', 'UNAUTHORIZED');
      }

      // Extract learner ID from path parameters
      const learnerId = event.pathParameters?.id;

      if (!learnerId) {
        return errorResponse(400, 'Learner ID is required', 'MISSING_LEARNER_ID');
      }

      // Parse request body
      if (!event.body) {
        return errorResponse(400, 'Request body is required', 'INVALID_REQUEST');
      }

      let body: EditLearnerSubjectsRequestBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'Request body must be valid JSON', 'INVALID_JSON');
      }

      // Validate subjectIds is a non-empty array
      if (!Array.isArray(body.subjectIds)) {
        return errorResponse(400, 'subjectIds must be an array', 'INVALID_SUBJECT_IDS');
      }

      if (body.subjectIds.length === 0) {
        return errorResponse(400, 'At least one subject must be assigned', 'MIN_SUBJECTS_REQUIRED');
      }

      // Validate all subjectIds are non-empty strings
      const hasInvalidIds = body.subjectIds.some(
        (id) => typeof id !== 'string' || id.trim().length === 0,
      );
      if (hasInvalidIds) {
        return errorResponse(400, 'All subject IDs must be non-empty strings', 'INVALID_SUBJECT_IDS');
      }

      // Verify learner exists
      const learner = await dbClient.getLearnerById(learnerId);

      if (!learner) {
        return errorResponse(404, 'Learner not found', 'LEARNER_NOT_FOUND');
      }

      // Verify parent owns this learner
      if (learner.parentId !== parentId) {
        return errorResponse(403, 'You do not have permission to modify this learner', 'FORBIDDEN');
      }

      // Update subjects
      const updatedSubjects = await dbClient.updateLearnerSubjects(learnerId, body.subjectIds);

      const response: EditLearnerSubjectsSuccessResponse = {
        success: true,
        subjects: updatedSubjects,
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return errorResponse(500, 'Something went wrong — please try again after some time', 'INTERNAL_ERROR');
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  message: string,
  errorCode: string,
): APIGatewayProxyResult {
  const body: EditLearnerSubjectsErrorResponse = {
    success: false,
    errorCode,
    message,
  };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
