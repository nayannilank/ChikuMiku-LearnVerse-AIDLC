/**
 * Forgot Password Lambda Handler
 *
 * Looks up user by email + phone, generates OTPs for both channels,
 * stores OTP session with 10-minute expiry, and sends notifications.
 *
 * Requirements: 1.31, 1.32, 1.33, 1.34, 1.38
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from '@learnverse/service-core';
import { randomUUID, randomInt } from 'crypto';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface UserLookupClient {
  findByEmailAndPhone(email: string, phone: string): Promise<{ id: string; username: string } | null>;
}

export interface OtpStore {
  saveOtpSession(session: {
    id: string;
    userId: string;
    emailOtp: string;
    phoneOtp: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface NotificationClient {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
}

// ============================================================
// Constants
// ============================================================

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Helpers
// ============================================================

/** Generates a 6-digit numeric OTP string. */
export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a forgotPassword Lambda handler with injected dependencies.
 */
export function createForgotPasswordHandler(
  userLookup: UserLookupClient,
  otpStore: OtpStore,
  notificationClient: NotificationClient,
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

      let body: { email?: string; phone?: string };
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
      if (!body.email || typeof body.email !== 'string' || !body.phone || typeof body.phone !== 'string') {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Both email and phone are required',
          }),
        };
      }

      // Look up user by email and phone combination
      const user = await userLookup.findByEmailAndPhone(body.email, body.phone);
      if (!user) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'USER_NOT_FOUND',
            message: 'No account found with this email and phone combination',
          }),
        };
      }

      // Generate OTPs
      const emailOtp = generateOtp();
      const phoneOtp = generateOtp();
      const otpSessionId = randomUUID();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      // Store OTP session
      await otpStore.saveOtpSession({
        id: otpSessionId,
        userId: user.id,
        emailOtp,
        phoneOtp,
        expiresAt,
      });

      // Send notifications
      await notificationClient.sendEmail(
        body.email,
        'LearnVerse Password Recovery OTP',
        `Your password recovery OTP is: ${emailOtp}. It expires in 10 minutes.`,
      );

      await notificationClient.sendSms(
        body.phone,
        `Your LearnVerse password recovery OTP is: ${phoneOtp}. It expires in 10 minutes.`,
      );

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'OTPs sent to registered email and phone',
          otpSessionId,
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
