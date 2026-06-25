/**
 * Get Parent Learners Lambda Handler
 *
 * Returns the list of learners (students) registered under the authenticated parent,
 * including each learner's assigned subjects.
 *
 * GET /parent/learners
 *
 * Requirements: 22.2, 22.4
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaHandler } from '@learnverse/service-core';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface LearnerWithSubjects {
  id: string;
  name: string;
  grade: string;
  subjects: Array<{ id: string; name: string; color: string }>;
}

export interface ParentLearnersDbClient {
  getLearnersByParentId(parentId: string): Promise<LearnerWithSubjects[]>;
}

// ============================================================
// Types
// ============================================================

export interface GetParentLearnersSuccessResponse {
  success: true;
  learners: LearnerWithSubjects[];
}

export interface GetParentLearnersErrorResponse {
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
 * Creates a getParentLearners Lambda handler with injected DB client dependency.
 */
export function createGetParentLearnersHandler(dbClient: ParentLearnersDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract parentId from JWT claims
      const parentId = event.requestContext?.authorizer?.claims?.sub;

      if (!parentId) {
        return errorResponse(401, 'Authentication required', 'UNAUTHORIZED');
      }

      // Fetch learners for this parent
      const learners = await dbClient.getLearnersByParentId(parentId);

      const response: GetParentLearnersSuccessResponse = {
        success: true,
        learners,
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
  const body: GetParentLearnersErrorResponse = {
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
