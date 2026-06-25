/**
 * Unit tests for the forgot password Lambda handler.
 *
 * Tests user lookup, OTP generation/storage, notification dispatch, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createForgotPasswordHandler,
  generateOtp,
  type UserLookupClient,
  type OtpStore,
  type NotificationClient,
} from './forgotPassword';

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
    path: '/auth/forgot-password',
    resource: '/auth/forgot-password',
  };
}

function createMockUserLookup(): UserLookupClient {
  return {
    findByEmailAndPhone: vi.fn().mockResolvedValue({ id: 'user-123', username: 'testuser1' }),
  };
}

function createMockOtpStore(): OtpStore {
  return {
    saveOtpSession: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationClient(): NotificationClient {
  return {
    sendEmail: vi.fn().mockResolvedValue(undefined),
    sendSms: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('forgotPassword handler', () => {
  let userLookup: UserLookupClient;
  let otpStore: OtpStore;
  let notificationClient: NotificationClient;
  let handler: ReturnType<typeof createForgotPasswordHandler>;

  beforeEach(() => {
    userLookup = createMockUserLookup();
    otpStore = createMockOtpStore();
    notificationClient = createMockNotificationClient();
    handler = createForgotPasswordHandler(userLookup, otpStore, notificationClient);
  });

  describe('successful OTP generation', () => {
    it('should return 200 with otpSessionId on valid email+phone', async () => {
      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('OTPs sent to registered email and phone');
      expect(body.otpSessionId).toBeDefined();
      expect(typeof body.otpSessionId).toBe('string');
    });

    it('should look up user by email and phone', async () => {
      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      await handler(event);

      expect(userLookup.findByEmailAndPhone).toHaveBeenCalledWith('test@example.com', '9876543210');
    });

    it('should save OTP session with 10-minute expiry', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      await handler(event);

      expect(otpStore.saveOtpSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          expiresAt: new Date(now + 10 * 60 * 1000),
        }),
      );

      vi.restoreAllMocks();
    });

    it('should send email OTP notification', async () => {
      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      await handler(event);

      expect(notificationClient.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'LearnVerse Password Recovery OTP',
        expect.stringContaining('password recovery OTP'),
      );
    });

    it('should send SMS OTP notification', async () => {
      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      await handler(event);

      expect(notificationClient.sendSms).toHaveBeenCalledWith(
        '9876543210',
        expect.stringContaining('password recovery OTP'),
      );
    });

    it('should store separate OTPs for email and phone', async () => {
      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      await handler(event);

      const savedSession = (otpStore.saveOtpSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedSession.emailOtp).toBeDefined();
      expect(savedSession.phoneOtp).toBeDefined();
      expect(savedSession.emailOtp).toHaveLength(6);
      expect(savedSession.phoneOtp).toHaveLength(6);
    });
  });

  describe('user not found', () => {
    it('should return 404 when email+phone combo not found', async () => {
      (userLookup.findByEmailAndPhone as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent({ email: 'unknown@example.com', phone: '1111111111' });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('USER_NOT_FOUND');
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

    it('should return 400 when email is missing', async () => {
      const event = createMockEvent({ phone: '9876543210' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when phone is missing', async () => {
      const event = createMockEvent({ email: 'test@example.com' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('internal error handling', () => {
    it('should return 500 when user lookup throws', async () => {
      (userLookup.findByEmailAndPhone as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when OTP store throws', async () => {
      (otpStore.saveOtpSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Store unavailable'),
      );

      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when notification client throws', async () => {
      (notificationClient.sendEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Email service down'),
      );

      const event = createMockEvent({ email: 'test@example.com', phone: '9876543210' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('generateOtp helper', () => {
    it('should generate a 6-digit string', () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate different values on multiple calls', () => {
      const otps = new Set(Array.from({ length: 10 }, () => generateOtp()));
      // With 10 calls, very unlikely all are the same
      expect(otps.size).toBeGreaterThan(1);
    });
  });
});
