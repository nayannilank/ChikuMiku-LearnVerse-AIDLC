/**
 * Error Types — Shared error response interface and error codes.
 *
 * All API endpoints return errors in this standardized format.
 */

// ============================================================
// Error Response Interface
// ============================================================

export interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: string;
  fieldErrors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

// ============================================================
// Error Codes
// ============================================================

export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Registration Conflicts
  DUPLICATE_USERNAME: 'DUPLICATE_USERNAME',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_PHONE: 'DUPLICATE_PHONE',

  // OTP
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',

  // Resource Errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // File Upload
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MAX_PAGES_REACHED: 'MAX_PAGES_REACHED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',

  // Content Processing
  OCR_FAILED: 'OCR_FAILED',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  TRANSCRIPT_NOT_FOUND: 'TRANSCRIPT_NOT_FOUND',

  // Quiz
  QUIZ_SESSION_EXPIRED: 'QUIZ_SESSION_EXPIRED',
  QUIZ_ALREADY_COMPLETED: 'QUIZ_ALREADY_COMPLETED',
  QUESTION_ALREADY_ANSWERED: 'QUESTION_ALREADY_ANSWERED',

  // Pronunciation
  AUDIO_PROCESSING_FAILED: 'AUDIO_PROCESSING_FAILED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
