/**
 * Structured Logger with Sensitive Data Masking
 *
 * Outputs JSON-formatted log entries to stdout.
 * Implements masking rules per Requirements 23.1–23.7:
 * - Passwords: NEVER logged
 * - JWT tokens: NEVER logged
 * - OTP values: NEVER logged
 * - Emails: masked as "d***@domain.com"
 */

// ============================================================
// Types
// ============================================================

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEntry {
  timestamp: string;
  severity: LogSeverity;
  userId?: string;
  operationType?: string;
  result?: string;
  resourceType?: string;
  resourceId?: string;
  requestPath?: string;
  errorMessage?: string;
  stackTrace?: string;
  requestBody?: Record<string, unknown>;
  durationMs?: number;
  [key: string]: unknown;
}

/** AI service call log entry fields (Req 23.5) */
export interface AIGatewayLogEntry {
  serviceName: string;
  requestParams?: Record<string, unknown>;
  errorResponse?: unknown;
  retryCount: number;
}

export interface Logger {
  info(operationType: string, data?: Record<string, unknown>): void;
  warn(operationType: string, data?: Record<string, unknown>): void;
  error(operationType: string, error?: unknown, data?: Record<string, unknown>): void;
  /** Log AI Gateway calls per Req 23.5 */
  logAIGatewayCall(entry: AIGatewayLogEntry & { result: 'success' | 'failure' }): void;
  /** Log 5xx server errors with full stack trace and request body per Req 23.4 */
  logServerError(operationType: string, error: Error, requestBody?: Record<string, unknown>): void;
  /** Start a timer for duration tracking */
  startTimer(): () => number;
}

// ============================================================
// Operation Type Constants (Req 23.1)
// ============================================================

export const OperationTypes = {
  // Auth operations
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTRATION_PARENT: 'registration_parent',
  REGISTRATION_STUDENT: 'registration_student',

  // Content operations
  SUBJECT_CREATE: 'subject_create',
  BOOK_CREATE: 'book_create',
  CHAPTER_CREATE: 'chapter_create',
  PAGE_UPLOAD: 'page_upload',
  TRANSCRIPT_SAVE: 'transcript_save',

  // Exercise operations
  EXERCISE_COMPLETION: 'exercise_completion',

  // AI Gateway operations
  AI_GATEWAY_CALL: 'ai_gateway_call',
  AI_GATEWAY_ERROR: 'ai_gateway_error',
} as const;

export type OperationType = (typeof OperationTypes)[keyof typeof OperationTypes];

// ============================================================
// AI Service Names
// ============================================================

export const AIServiceNames = {
  GOOGLE_VISION_OCR: 'google_vision_ocr',
  GPT5_MINI: 'gpt5_mini',
  GOOGLE_TTS: 'google_tts',
  WHISPER: 'whisper',
  OPENAI_EMBEDDINGS: 'openai_embeddings',
} as const;

export type AIServiceName = (typeof AIServiceNames)[keyof typeof AIServiceNames];

// ============================================================
// Logger Factory
// ============================================================

/**
 * Creates a structured logger bound to a request context.
 */
export function createLogger(context: { userId?: string; requestPath?: string }): Logger {
  function emit(severity: LogSeverity, operationType: string, extra?: Record<string, unknown>): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      operationType,
      ...(context.userId && { userId: context.userId }),
      ...(context.requestPath && { requestPath: context.requestPath }),
      ...(extra && maskSensitiveData(extra)),
    };

    // Output as single-line JSON to stdout (CloudWatch compatible)
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  return {
    info(operationType: string, data?: Record<string, unknown>): void {
      emit('INFO', operationType, { result: 'success', ...data });
    },

    warn(operationType: string, data?: Record<string, unknown>): void {
      emit('WARN', operationType, data);
    },

    error(operationType: string, error?: unknown, data?: Record<string, unknown>): void {
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';

      emit('ERROR', operationType, { result: 'failure', errorMessage, ...data });
    },

    logAIGatewayCall(entry: AIGatewayLogEntry & { result: 'success' | 'failure' }): void {
      const severity: LogSeverity = entry.result === 'success' ? 'INFO' : 'ERROR';
      const operationType = entry.result === 'success'
        ? OperationTypes.AI_GATEWAY_CALL
        : OperationTypes.AI_GATEWAY_ERROR;

      emit(severity, operationType, {
        result: entry.result,
        serviceName: entry.serviceName,
        retryCount: entry.retryCount,
        ...(entry.requestParams && { requestParams: entry.requestParams }),
        ...(entry.errorResponse !== undefined && { errorResponse: entry.errorResponse }),
      });
    },

    logServerError(operationType: string, error: Error, requestBody?: Record<string, unknown>): void {
      const maskedBody = requestBody ? maskSensitiveData(requestBody) : undefined;
      emit('ERROR', operationType, {
        result: 'failure',
        errorMessage: error.message,
        stackTrace: error.stack ?? '',
        ...(maskedBody && { requestBody: maskedBody }),
      });
    },

    startTimer(): () => number {
      const start = Date.now();
      return () => Date.now() - start;
    },
  };
}

// ============================================================
// Sensitive Data Masking
// ============================================================

/** Fields whose keys match these patterns will be stripped entirely */
const STRIP_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /otp/i,
  /accesskey/i,
];

/** Fields whose keys match this pattern have their values masked as emails */
const EMAIL_KEY_PATTERNS = [/email/i, /mail/i];

/**
 * Masks sensitive data in a record.
 *
 * - Keys containing "password", "token", "authorization", "otp", "secret" → stripped
 * - Keys containing "email"/"mail" → value masked as "d***@domain.com"
 * - Other values pass through unchanged
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if key should be stripped entirely
    if (STRIP_KEY_PATTERNS.some(p => p.test(key))) {
      masked[key] = '[REDACTED]';
      continue;
    }

    // Check if key is an email field
    if (EMAIL_KEY_PATTERNS.some(p => p.test(key)) && typeof value === 'string') {
      masked[key] = maskEmail(value);
      continue;
    }

    // Recursively mask nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
      continue;
    }

    masked[key] = value;
  }

  return masked;
}

/**
 * Masks an email address: "developer@example.com" → "d***@example.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***';

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  return localPart.charAt(0) + '***' + domain;
}
