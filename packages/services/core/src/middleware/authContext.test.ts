import { describe, it, expect } from 'vitest';
import { extractAuthContext, extractAuthContextOptional } from './authContext.js';
import { ServiceError } from './errorHandler.js';
import type { APIGatewayProxyEvent } from '../lambdaTypes.js';

function makeEvent(claims?: Record<string, string>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: claims ? { claims } : undefined,
    },
    httpMethod: 'GET',
    path: '/test',
    resource: '/test',
  };
}

describe('extractAuthContext', () => {
  it('extracts userId, role, groups, and username from valid claims', () => {
    const event = makeEvent({
      sub: 'user-123',
      'cognito:username': 'john_doe',
      'cognito:groups': 'students,readers',
      'custom:userType': 'student',
    });

    const ctx = extractAuthContext(event);

    expect(ctx.userId).toBe('user-123');
    expect(ctx.username).toBe('john_doe');
    expect(ctx.role).toBe('student');
    expect(ctx.groups).toEqual(['students', 'readers']);
  });

  it('resolves parent role from custom:userType', () => {
    const event = makeEvent({
      sub: 'parent-456',
      'cognito:username': 'parent_user',
      'cognito:groups': '',
      'custom:userType': 'parent',
    });

    const ctx = extractAuthContext(event);
    expect(ctx.role).toBe('parent');
  });

  it('falls back to group membership when custom:userType is missing', () => {
    const event = makeEvent({
      sub: 'user-789',
      'cognito:username': 'group_user',
      'cognito:groups': 'parents',
    });

    const ctx = extractAuthContext(event);
    expect(ctx.role).toBe('parent');
  });

  it('defaults to student role when no role indicators present', () => {
    const event = makeEvent({
      sub: 'user-000',
      'cognito:username': 'default_user',
      'cognito:groups': '',
    });

    const ctx = extractAuthContext(event);
    expect(ctx.role).toBe('student');
  });

  it('throws ServiceError 401 when claims are missing', () => {
    const event = makeEvent(undefined);

    expect(() => extractAuthContext(event)).toThrow(ServiceError);
    try {
      extractAuthContext(event);
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).statusCode).toBe(401);
    }
  });

  it('throws ServiceError 401 when sub is missing', () => {
    const event = makeEvent({
      'cognito:username': 'no_sub_user',
    });

    expect(() => extractAuthContext(event)).toThrow(ServiceError);
  });

  it('handles empty groups claim', () => {
    const event = makeEvent({
      sub: 'user-empty-groups',
      'cognito:username': 'user',
      'cognito:groups': '',
      'custom:userType': 'student',
    });

    const ctx = extractAuthContext(event);
    expect(ctx.groups).toEqual([]);
  });
});

describe('extractAuthContextOptional', () => {
  it('returns null when claims are absent', () => {
    const event = makeEvent(undefined);
    expect(extractAuthContextOptional(event)).toBeNull();
  });

  it('returns AuthContext when claims are valid', () => {
    const event = makeEvent({
      sub: 'user-opt',
      'cognito:username': 'opt_user',
      'cognito:groups': '',
      'custom:userType': 'student',
    });

    const ctx = extractAuthContextOptional(event);
    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe('user-opt');
  });

  it('returns null when claims are present but invalid (no sub)', () => {
    const event = makeEvent({
      'cognito:username': 'invalid_user',
    });

    expect(extractAuthContextOptional(event)).toBeNull();
  });
});
