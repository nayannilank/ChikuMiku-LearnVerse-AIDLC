/**
 * Login Lambda Handler
 *
 * Authenticates a user (parent or student) against Cognito with username,
 * password, and role. Returns JWT access token + refresh token on success,
 * with role-based redirect routing.
 *
 * On failure due to invalid credentials: returns 401 with
 * "incorrect username or password", preserves username, clears password indication.
 *
 * Requirements: 1.2, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaHandler } from '@learnverse/service-core';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface CognitoAuthClient {
  authenticate(params: {
    username: string;
    password: string;
  }): Promise<AuthTokens>;

  getUserGroups(username: string): Promise<string[]>;
}

// ============================================================
// Types
// ============================================================

export type UserRole = 'parent' | 'student';

export interface LoginRequestBody {
  username: string;
  password: string;
  role?: string;
}

export interface LoginSuccessResponse {
  success: true;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  role: UserRole;
  redirectTo: string;
}

export interface LoginErrorResponse {
  success: false;
  errorCode?: string;
  message: string;
  username?: string;
  missingFields?: string[];
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
// Role-Based Routing
// ============================================================

const ROLE_REDIRECT_MAP: Record<UserRole, string> = {
  parent: '/parent/dashboard',
  student: '/dashboard',
};

/**
 * Determine the effective user role from Cognito groups.
 * Returns the first matching role or null if no recognized role found.
 */
function resolveRole(groups: string[]): UserRole | null {
  if (groups.includes('parent')) return 'parent';
  if (groups.includes('student')) return 'student';
  return null;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a login Lambda handler with injected CognitoAuthClient dependency.
 * This allows easy testing by providing a mock auth client.
 */
export function createLoginHandler(cognitoAuthClient: CognitoAuthClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse body
      if (!event.body) {
        return errorResponse(400, 'Request body is required', 'INVALID_REQUEST');
      }

      let body: LoginRequestBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'Request body must be valid JSON', 'INVALID_JSON');
      }

      // Validate required fields
      const missingFields: string[] = [];

      if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
        missingFields.push('username');
      }
      if (!body.password || typeof body.password !== 'string' || body.password.trim().length === 0) {
        missingFields.push('password');
      }

      if (missingFields.length > 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            errorCode: 'MISSING_FIELDS',
            message: `Missing required fields: ${missingFields.join(', ')}`,
            missingFields,
          } satisfies LoginErrorResponse),
        };
      }

      // Authenticate against Cognito
      let tokens: AuthTokens;
      try {
        tokens = await cognitoAuthClient.authenticate({
          username: body.username.trim(),
          password: body.password,
        });
      } catch {
        // Authentication failure — incorrect credentials
        return credentialsErrorResponse(body.username);
      }

      // Determine user's role from Cognito groups
      const groups = await cognitoAuthClient.getUserGroups(body.username.trim());
      const role = resolveRole(groups);

      if (!role) {
        // User is authenticated but doesn't belong to a recognized role group
        return credentialsErrorResponse(body.username);
      }

      // Determine redirect path based on role
      const redirectTo = ROLE_REDIRECT_MAP[role];

      // Success response
      const response: LoginSuccessResponse = {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        role,
        redirectTo,
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
  errorCode?: string,
): APIGatewayProxyResult {
  const body: LoginErrorResponse = { success: false, message };
  if (errorCode) {
    body.errorCode = errorCode;
  }
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Returns a 401 response with preserved username and cleared password indication.
 * Per requirement 1.12: preserve username field value, clear password field.
 */
function credentialsErrorResponse(username: string): APIGatewayProxyResult {
  const body: LoginErrorResponse = {
    success: false,
    errorCode: 'INVALID_CREDENTIALS',
    message: 'incorrect username or password',
    username,
  };
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
