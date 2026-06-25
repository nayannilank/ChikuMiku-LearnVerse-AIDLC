/**
 * Reset Password Lambda Handler
 *
 * Validates a reset token, enforces password complexity rules,
 * and updates the password in Cognito.
 *
 * Requirements: 1.36, 1.37
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from '@learnverse/service-core';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface ResetTokenStore {
  getResetToken(tokenId: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
  } | null>;
  deleteResetToken(tokenId: string): Promise<void>;
}

export interface CognitoPasswordClient {
  setPassword(username: string, newPassword: string): Promise<void>;
}

export interface UserLookupByIdClient {
  findById(userId: string): Promise<{ id: string; username: string } | null>;
}

// ============================================================
// Constants
// ============================================================

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Password Validation
// ============================================================

interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

function validatePasswordComplexity(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'New password is required' };
  }

  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { valid: false, message: `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters` };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a resetPassword Lambda handler with injected dependencies.
 */
export function createResetPasswordHandler(
  resetTokenStore: ResetTokenStore,
  cognitoClient: CognitoPasswordClient,
  userLookup: UserLookupByIdClient,
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse request body
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

      let body: { resetToken?: string; newPassword?: string };
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      // Validate required fields
      if (!body.resetToken || typeof body.resetToken !== 'string') {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Reset token is required',
          }),
        };
      }

      if (!body.newPassword || typeof body.newPassword !== 'string') {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'New password is required',
          }),
        };
      }

      // Validate password complexity
      const passwordValidation = validatePasswordComplexity(body.newPassword);
      if (!passwordValidation.valid) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PASSWORD',
            message: passwordValidation.message,
          }),
        };
      }

      // Validate reset token
      const tokenEntry = await resetTokenStore.getResetToken(body.resetToken);
      if (!tokenEntry) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          }),
        };
      }

      // Check token expiry
      if (new Date() > tokenEntry.expiresAt) {
        await resetTokenStore.deleteResetToken(body.resetToken);
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'EXPIRED_TOKEN',
            message: 'Invalid or expired reset token',
          }),
        };
      }

      // Look up user to get username for Cognito
      const user = await userLookup.findById(tokenEntry.userId);
      if (!user) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'USER_NOT_FOUND',
            message: 'Invalid or expired reset token',
          }),
        };
      }

      // Update password in Cognito
      await cognitoClient.setPassword(user.username, body.newPassword);

      // Clean up reset token
      await resetTokenStore.deleteResetToken(body.resetToken);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'Password reset successful',
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'Something went wrong — please try again after some time',
        }),
      };
    }
  };
}
