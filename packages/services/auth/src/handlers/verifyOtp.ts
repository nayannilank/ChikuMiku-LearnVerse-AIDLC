/**
 * Verify OTP Lambda Handler
 *
 * Validates both email and phone OTPs against a stored session.
 * On success, generates a short-lived reset token for password reset.
 *
 * Requirements: 1.34, 1.35
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from '@learnverse/service-core';
import { randomUUID } from 'crypto';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface OtpStore {
  getOtpSession(sessionId: string): Promise<{
    id: string;
    userId: string;
    emailOtp: string;
    phoneOtp: string;
    expiresAt: Date;
  } | null>;
  deleteOtpSession(sessionId: string): Promise<void>;
}

export interface ResetTokenStore {
  saveResetToken(token: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
}

// ============================================================
// Constants
// ============================================================

/** Reset token TTL: 15 minutes */
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

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
 * Creates a verifyOtp Lambda handler with injected dependencies.
 */
export function createVerifyOtpHandler(
  otpStore: OtpStore,
  resetTokenStore: ResetTokenStore,
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

      let body: { otpSessionId?: string; emailOtp?: string; phoneOtp?: string };
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
      if (
        !body.otpSessionId || typeof body.otpSessionId !== 'string' ||
        !body.emailOtp || typeof body.emailOtp !== 'string' ||
        !body.phoneOtp || typeof body.phoneOtp !== 'string'
      ) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'otpSessionId, emailOtp, and phoneOtp are required',
          }),
        };
      }

      // Retrieve OTP session
      const session = await otpStore.getOtpSession(body.otpSessionId);
      if (!session) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_OTP',
            message: 'Invalid or expired OTP',
          }),
        };
      }

      // Check expiry
      if (new Date() > session.expiresAt) {
        await otpStore.deleteOtpSession(body.otpSessionId);
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'EXPIRED_OTP',
            message: 'Invalid or expired OTP',
          }),
        };
      }

      // Validate both OTPs
      if (body.emailOtp !== session.emailOtp || body.phoneOtp !== session.phoneOtp) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_OTP',
            message: 'Invalid or expired OTP',
          }),
        };
      }

      // OTPs are valid — clean up session
      await otpStore.deleteOtpSession(body.otpSessionId);

      // Generate reset token
      const resetTokenId = randomUUID();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await resetTokenStore.saveResetToken({
        id: resetTokenId,
        userId: session.userId,
        expiresAt,
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'OTP verified successfully',
          resetToken: resetTokenId,
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
