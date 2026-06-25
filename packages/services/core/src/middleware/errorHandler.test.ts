import { describe, it, expect } from 'vitest';
import { ServiceError, handleError } from './errorHandler.js';

describe('ServiceError', () => {
  it('creates error with statusCode, errorCode, and message', () => {
    const err = new ServiceError('Not found', 404, 'NOT_FOUND');

    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('NOT_FOUND');
    expect(err.name).toBe('ServiceError');
    expect(err).toBeInstanceOf(Error);
  });

  it('supports optional details and fieldErrors', () => {
    const err = new ServiceError('Bad request', 400, 'VALIDATION_ERROR', {
      details: 'Name too short',
      fieldErrors: [{ field: 'name', message: 'Must be at least 5 chars' }],
    });

    expect(err.details).toBe('Name too short');
    expect(err.fieldErrors).toHaveLength(1);
    expect(err.fieldErrors![0].field).toBe('name');
  });
});

describe('handleError', () => {
  it('formats ServiceError into correct API response', () => {
    const err = new ServiceError('Forbidden', 403, 'FORBIDDEN');
    const result = handleError(err);

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.statusCode).toBe(403);
    expect(body.errorCode).toBe('FORBIDDEN');
    expect(body.message).toBe('Forbidden');
  });

  it('includes CORS headers in response', () => {
    const err = new ServiceError('Error', 400, 'VALIDATION_ERROR');
    const result = handleError(err);

    expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers!['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('includes fieldErrors when present', () => {
    const err = new ServiceError('Validation failed', 400, 'VALIDATION_ERROR', {
      fieldErrors: [
        { field: 'email', message: 'Invalid email' },
        { field: 'name', message: 'Required' },
      ],
    });
    const result = handleError(err);
    const body = JSON.parse(result.body);

    expect(body.fieldErrors).toHaveLength(2);
    expect(body.fieldErrors[0].field).toBe('email');
  });

  it('returns 500 INTERNAL_ERROR for unknown errors', () => {
    const result = handleError(new Error('Something unexpected'));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred');
  });

  it('returns 500 INTERNAL_ERROR for non-Error objects', () => {
    const result = handleError('a string error');

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('does not include details field when not provided', () => {
    const err = new ServiceError('Not found', 404, 'NOT_FOUND');
    const result = handleError(err);
    const body = JSON.parse(result.body);

    expect(body.details).toBeUndefined();
    expect(body.fieldErrors).toBeUndefined();
  });
});
