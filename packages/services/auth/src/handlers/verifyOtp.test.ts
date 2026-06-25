/**
 * Unit tests for the verify OTP Lambda handler.
 *
 * Tests OTP validation, expiry checks, reset token generation, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createVerifyOtpHandler,
  type OtpStore,
  type ResetTokenStore,
} from './verifyOtp';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body === null ? null : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { requestId: 'test-request-id' },
    httpMethod: 'POST',
    path: '/auth/verify-otp',
    resource: '/auth/verify-otp',
  };
}

function createValidOtpSession() {
  return {
    id: 'session-123',
    userId: 'user-456',
    emailOtp: '123456',
    phoneOtp: '654321',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
  };
}

function createMockOtpStore(session = createValidOtpSession()): OtpStore {
  return {
    getOtpSession: vi.fn().mockResolvedValue(session),
    deleteOtpSession: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockResetTokenStore(): ResetTokenStore {
  return {
    saveResetToken: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('verifyOtp handler', () => {
  let otpStore: OtpStore;
  let resetTokenStore: ResetTokenStore;
  let handler: ReturnType<typeof createVerifyOtpHandler>;

  beforeEach(() => {
    otpStore = createMockOtpStore();
    resetTokenStore = createMockResetTokenStore();
    handler = createVerifyOtpHandler(otpStore, resetTokenStore);
  });

  describe('successful OTP verification', () => {
    it('should return 200 with resetToken when both OTPs are correct', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.resetToken).toBeDefined();
      expect(typeof body.resetToken).toBe('string');
      expect(body.message).toBe('OTP verified successfully');
    });

    it('should save reset token with userId from session', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      await handler(event);

      expect(resetTokenStore.saveResetToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
        }),
      );
    });

    it('should delete OTP session after successful verification', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      await handler(event);

      expect(otpStore.deleteOtpSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('invalid OTP', () => {
    it('should return 400 when email OTP is wrong', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '000000',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired OTP');
    });

    it('should return 400 when phone OTP is wrong', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '000000',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired OTP');
    });

    it('should return 400 when both OTPs are wrong', async () => {
      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '111111',
        phoneOtp: '222222',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired OTP');
    });
  });

  describe('expired OTP session', () => {
    it('should return 400 when OTP session is expired', async () => {
      const expiredSession = {
        ...createValidOtpSession(),
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      };
      otpStore = createMockOtpStore(expiredSession);
      handler = createVerifyOtpHandler(otpStore, resetTokenStore);

      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired OTP');
    });

    it('should delete expired session on access', async () => {
      const expiredSession = {
        ...createValidOtpSession(),
        expiresAt: new Date(Date.now() - 1000),
      };
      otpStore = createMockOtpStore(expiredSession);
      handler = createVerifyOtpHandler(otpStore, resetTokenStore);

      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      await handler(event);

      expect(otpStore.deleteOtpSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('session not found', () => {
    it('should return 400 when session ID does not exist', async () => {
      (otpStore.getOtpSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent({
        otpSessionId: 'nonexistent',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired OTP');
    });
  });

  describe('request body validation', () => {
    it('should return 400 when body is null', async () => {
      const event = createMockEvent(null);
      event.body = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({});
      event.body = 'not json';
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('should return 400 when otpSessionId is missing', async () => {
      const event = createMockEvent({ emailOtp: '123456', phoneOtp: '654321' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when emailOtp is missing', async () => {
      const event = createMockEvent({ otpSessionId: 'session-123', phoneOtp: '654321' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when phoneOtp is missing', async () => {
      const event = createMockEvent({ otpSessionId: 'session-123', emailOtp: '123456' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('internal error handling', () => {
    it('should return 500 when OTP store throws', async () => {
      (otpStore.getOtpSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Store unavailable'),
      );

      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when reset token store throws', async () => {
      (resetTokenStore.saveResetToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Store unavailable'),
      );

      const event = createMockEvent({
        otpSessionId: 'session-123',
        emailOtp: '123456',
        phoneOtp: '654321',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
