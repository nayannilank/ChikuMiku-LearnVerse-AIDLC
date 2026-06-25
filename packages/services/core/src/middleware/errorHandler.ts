/**
 * Error Handler Middleware
 *
 * Provides a global error handler that formats errors into the standardized
 * ApiErrorResponse structure (matching @learnverse/platform-contracts).
 */

import type { APIGatewayProxyResult } from '../lambdaTypes.js';

// Re-declare the contract types locally to avoid a circular dependency
// between services/core ↔ platform-contracts.
export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: string;
  fieldErrors?: FieldError[];
}

// ============================================================
// ServiceError Class
// ============================================================

/**
 * Application-level error with HTTP status code and error code.
 * Throw this from handlers to produce a well-formatted error response.
 */
export class ServiceError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: string;
  public readonly fieldErrors?: FieldError[];

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    options?: { details?: string; fieldErrors?: FieldError[] },
  ) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = options?.details;
    this.fieldErrors = options?.fieldErrors;
  }
}

// ============================================================
// CORS Headers
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// ============================================================
// Error Handler
// ============================================================

/**
 * Converts an unknown error into a formatted APIGatewayProxyResult
 * with the ApiErrorResponse body and CORS headers.
 */
export function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof ServiceError) {
    const body: ApiErrorResponse = {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    };

    return {
      statusCode: error.statusCode,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify(body),
    };
  }

  // Unhandled/unknown errors — do not leak internals
  const body: ApiErrorResponse = {
    statusCode: 500,
    errorCode: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}
