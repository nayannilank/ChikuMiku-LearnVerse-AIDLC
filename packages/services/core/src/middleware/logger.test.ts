import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, maskSensitiveData, maskEmail, OperationTypes, AIServiceNames } from './logger.js';

describe('maskEmail', () => {
  it('masks email as first char + *** + @domain', () => {
    expect(maskEmail('developer@example.com')).toBe('d***@example.com');
  });

  it('handles single char local part', () => {
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('returns *** for invalid email without @', () => {
    expect(maskEmail('nope')).toBe('***');
  });

  it('returns *** for email starting with @', () => {
    expect(maskEmail('@domain.com')).toBe('***');
  });
});

describe('maskSensitiveData', () => {
  it('redacts password fields', () => {
    const result = maskSensitiveData({ password: 'secret123', username: 'john' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.username).toBe('john');
  });

  it('redacts fields containing "token"', () => {
    const result = maskSensitiveData({ accessToken: 'jwt.abc.xyz', name: 'test' });
    expect(result.accessToken).toBe('[REDACTED]');
  });

  it('redacts fields containing "authorization"', () => {
    const result = maskSensitiveData({ Authorization: 'Bearer xyz' });
    expect(result.Authorization).toBe('[REDACTED]');
  });

  it('redacts otp fields', () => {
    const result = maskSensitiveData({ otpCode: '123456', userId: 'u1' });
    expect(result.otpCode).toBe('[REDACTED]');
  });

  it('masks email fields', () => {
    const result = maskSensitiveData({ email: 'test@example.com' });
    expect(result.email).toBe('t***@example.com');
  });

  it('recursively masks nested objects', () => {
    const result = maskSensitiveData({
      user: { email: 'nested@test.com', password: '123' },
    });
    const user = result.user as Record<string, unknown>;
    expect(user.email).toBe('n***@test.com');
    expect(user.password).toBe('[REDACTED]');
  });

  it('passes through non-sensitive fields unchanged', () => {
    const result = maskSensitiveData({ name: 'Alice', count: 5 });
    expect(result.name).toBe('Alice');
    expect(result.count).toBe(5);
  });
});

describe('createLogger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('logs info with correct structure', () => {
    const logger = createLogger({ userId: 'user-1', requestPath: '/api/test' });
    logger.info('fetchData', { resourceType: 'chapter', resourceId: 'ch-1' });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);

    expect(output.severity).toBe('INFO');
    expect(output.operationType).toBe('fetchData');
    expect(output.userId).toBe('user-1');
    expect(output.requestPath).toBe('/api/test');
    expect(output.resourceType).toBe('chapter');
    expect(output.result).toBe('success');
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs warn', () => {
    const logger = createLogger({});
    logger.warn('rateLimitApproaching', { remaining: 5 });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.severity).toBe('WARN');
    expect(output.remaining).toBe(5);
  });

  it('logs error with error message', () => {
    const logger = createLogger({ userId: 'user-2' });
    logger.error('saveData', new Error('DB connection failed'));

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.severity).toBe('ERROR');
    expect(output.errorMessage).toBe('DB connection failed');
    expect(output.result).toBe('failure');
  });

  it('masks sensitive data in log entries', () => {
    const logger = createLogger({});
    logger.info('login', { email: 'user@test.com', password: 'secret' });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.email).toBe('u***@test.com');
    expect(output.password).toBe('[REDACTED]');
  });

  it('omits userId and requestPath when not provided', () => {
    const logger = createLogger({});
    logger.info('startup');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.userId).toBeUndefined();
    expect(output.requestPath).toBeUndefined();
  });
});

describe('createLogger - AI Gateway logging (Req 23.5)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('logs successful AI Gateway call with service name, params, and retry count', () => {
    const logger = createLogger({ userId: 'user-1', requestPath: '/api/ocr' });
    logger.logAIGatewayCall({
      serviceName: AIServiceNames.GOOGLE_VISION_OCR,
      requestParams: { imageSize: 1024, format: 'png' },
      retryCount: 0,
      result: 'success',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.severity).toBe('INFO');
    expect(output.operationType).toBe(OperationTypes.AI_GATEWAY_CALL);
    expect(output.serviceName).toBe('google_vision_ocr');
    expect(output.requestParams).toEqual({ imageSize: 1024, format: 'png' });
    expect(output.retryCount).toBe(0);
    expect(output.result).toBe('success');
  });

  it('logs failed AI Gateway call with error response and retry count', () => {
    const logger = createLogger({ userId: 'user-2', requestPath: '/api/explain' });
    logger.logAIGatewayCall({
      serviceName: AIServiceNames.GPT5_MINI,
      requestParams: { model: 'gpt-5-mini', maxTokens: 500 },
      errorResponse: { code: 'rate_limit_exceeded', message: 'Too many requests' },
      retryCount: 3,
      result: 'failure',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.severity).toBe('ERROR');
    expect(output.operationType).toBe(OperationTypes.AI_GATEWAY_ERROR);
    expect(output.serviceName).toBe('gpt5_mini');
    expect(output.retryCount).toBe(3);
    expect(output.errorResponse).toEqual({ code: 'rate_limit_exceeded', message: 'Too many requests' });
    expect(output.result).toBe('failure');
  });

  it('masks sensitive data in AI Gateway request params', () => {
    const logger = createLogger({});
    logger.logAIGatewayCall({
      serviceName: AIServiceNames.WHISPER,
      requestParams: { audioUrl: '/audio/test.wav', userEmail: 'user@test.com' },
      retryCount: 1,
      result: 'success',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.requestParams.userEmail).toBe('u***@test.com');
  });

  it('omits requestParams and errorResponse when not provided', () => {
    const logger = createLogger({});
    logger.logAIGatewayCall({
      serviceName: AIServiceNames.GOOGLE_TTS,
      retryCount: 0,
      result: 'success',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.requestParams).toBeUndefined();
    expect(output.errorResponse).toBeUndefined();
  });
});

describe('createLogger - Server error logging (Req 23.4)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('logs 5xx error with stack trace and request body', () => {
    const logger = createLogger({ userId: 'user-3', requestPath: '/api/chapters' });
    const error = new Error('Connection refused');
    error.stack = 'Error: Connection refused\n    at db.connect (db.ts:42)\n    at handler (api.ts:10)';

    logger.logServerError('chapter_create', error, {
      chapterNumber: 5,
      textbookName: 'Science Grade 8',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.severity).toBe('ERROR');
    expect(output.operationType).toBe('chapter_create');
    expect(output.result).toBe('failure');
    expect(output.errorMessage).toBe('Connection refused');
    expect(output.stackTrace).toContain('db.connect');
    expect(output.requestBody).toEqual({ chapterNumber: 5, textbookName: 'Science Grade 8' });
  });

  it('masks sensitive fields in request body', () => {
    const logger = createLogger({ userId: 'user-4', requestPath: '/api/register' });
    const error = new Error('Duplicate user');

    logger.logServerError('registration_parent', error, {
      email: 'parent@example.com',
      password: 'supersecret',
      displayName: 'Parent User',
    });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.requestBody.email).toBe('p***@example.com');
    expect(output.requestBody.password).toBe('[REDACTED]');
    expect(output.requestBody.displayName).toBe('Parent User');
  });

  it('handles missing request body gracefully', () => {
    const logger = createLogger({});
    const error = new Error('Internal server error');
    logger.logServerError('page_upload', error);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.errorMessage).toBe('Internal server error');
    expect(output.requestBody).toBeUndefined();
  });

  it('handles error without stack trace', () => {
    const logger = createLogger({});
    const error = new Error('No stack');
    error.stack = undefined;
    logger.logServerError('login', error);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.stackTrace).toBe('');
  });
});

describe('createLogger - Duration tracking', () => {
  it('returns elapsed time in milliseconds', async () => {
    const logger = createLogger({});
    const endTimer = logger.startTimer();

    // Small delay to verify timer works
    await new Promise(resolve => setTimeout(resolve, 10));
    const duration = endTimer();

    expect(duration).toBeGreaterThanOrEqual(5);
    expect(duration).toBeLessThan(500);
  });
});

describe('OperationTypes constants', () => {
  it('includes all required operation types', () => {
    expect(OperationTypes.LOGIN).toBe('login');
    expect(OperationTypes.LOGOUT).toBe('logout');
    expect(OperationTypes.REGISTRATION_PARENT).toBe('registration_parent');
    expect(OperationTypes.REGISTRATION_STUDENT).toBe('registration_student');
    expect(OperationTypes.SUBJECT_CREATE).toBe('subject_create');
    expect(OperationTypes.BOOK_CREATE).toBe('book_create');
    expect(OperationTypes.CHAPTER_CREATE).toBe('chapter_create');
    expect(OperationTypes.PAGE_UPLOAD).toBe('page_upload');
    expect(OperationTypes.TRANSCRIPT_SAVE).toBe('transcript_save');
    expect(OperationTypes.EXERCISE_COMPLETION).toBe('exercise_completion');
    expect(OperationTypes.AI_GATEWAY_CALL).toBe('ai_gateway_call');
    expect(OperationTypes.AI_GATEWAY_ERROR).toBe('ai_gateway_error');
  });
});

describe('AIServiceNames constants', () => {
  it('includes all external AI services', () => {
    expect(AIServiceNames.GOOGLE_VISION_OCR).toBe('google_vision_ocr');
    expect(AIServiceNames.GPT5_MINI).toBe('gpt5_mini');
    expect(AIServiceNames.GOOGLE_TTS).toBe('google_tts');
    expect(AIServiceNames.WHISPER).toBe('whisper');
    expect(AIServiceNames.OPENAI_EMBEDDINGS).toBe('openai_embeddings');
  });
});
