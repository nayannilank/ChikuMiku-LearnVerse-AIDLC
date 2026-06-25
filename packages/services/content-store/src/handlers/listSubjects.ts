/**
 * List Subjects Handler
 *
 * GET /subjects
 *
 * Returns subjects assigned to the authenticated student via the
 * student_subjects join table.
 *
 * Requirements: 7.2, 18.1
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export interface SubjectRecord {
  id: string;
  name: string;
  isDefault: boolean;
  color: string;
  iconName: string;
}

export interface ListSubjectsDbClient {
  getSubjectsForStudent(studentId: string): Promise<SubjectRecord[]>;
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
 * Creates a listSubjects Lambda handler with an injected database client.
 */
export function createListSubjectsHandler(dbClient: ListSubjectsDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const studentId = event.requestContext.authorizer?.claims?.sub;

      if (!studentId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Missing authentication',
          }),
        };
      }

      const subjects = await dbClient.getSubjectsForStudent(studentId);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ subjects }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving subjects',
        }),
      };
    }
  };
}
