import { describe, it, expect, vi } from 'vitest';
import {
  createUploadRecordingHandler,
  buildRecordingS3Key,
  computeAudioRequestHash,
  computeSyllableAccuracy,
  MIN_RECORDING_DURATION_SECONDS,
  MAX_RECORDING_DURATION_SECONDS,
} from './uploadRecording';
import type {
  WhisperAiGatewayClient,
  RecordingS3Client,
  PronunciationDbClient,
  PronunciationWordRecord,
} from './uploadRecording';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: 'student-123-uuid-4567-abcd-ef0123456789' },
      },
    },
    httpMethod: 'POST',
    path: '/pronunciation/record',
    resource: '/pronunciation/record',
    ...overrides,
  };
}

function createMockAiGateway(): WhisperAiGatewayClient {
  return {
    process: vi.fn().mockResolvedValue({
      cached: false,
      data: { transcription: 'hello' },
    }),
  };
}

function createMockS3Client(): RecordingS3Client {
  return {
    upload: vi.fn().mockResolvedValue('recordings/student-123/subject-456/12345.webm'),
  };
}

function createMockDbClient(wordRecord: PronunciationWordRecord | null = null): PronunciationDbClient {
  return {
    getWord: vi.fn().mockResolvedValue(
      wordRecord || {
        id: '11111111-1111-1111-1111-111111111111',
        subjectId: '22222222-2222-2222-2222-222222222222',
        word: 'hello',
        phoneticTranscription: 'hɛˈloʊ',
        syllables: ['hel', 'lo'],
        referenceAudioS3Key: null,
        language: 'english',
      },
    ),
    saveExerciseResult: vi.fn().mockResolvedValue(undefined),
  };
}

function validRequestBody() {
  return JSON.stringify({
    audioData: Buffer.from('fake-audio-data').toString('base64'),
    durationSeconds: 2.5,
    wordId: '11111111-1111-1111-1111-111111111111',
    subjectId: '22222222-2222-2222-2222-222222222222',
  });
}

// ============================================================
// Tests
// ============================================================

describe('createUploadRecordingHandler', () => {
  describe('authentication', () => {
    it('returns 401 when no auth claims present', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: validRequestBody(),
        requestContext: { authorizer: {} },
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });
  });

  describe('request validation', () => {
    it('returns 400 when body is missing', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({ body: null });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('MISSING_BODY');
    });

    it('returns 400 when body is invalid JSON', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({ body: 'not json' });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 when audioData is missing', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          durationSeconds: 2,
          wordId: '11111111-1111-1111-1111-111111111111',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('MISSING_AUDIO');
    });

    it('returns 400 when wordId is invalid', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          audioData: 'dGVzdA==',
          durationSeconds: 2,
          wordId: 'not-a-uuid',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('INVALID_WORD_ID');
    });
  });

  describe('duration validation (Req 12.4, 20.6)', () => {
    it('returns 400 when recording is too short (< 0.5s)', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          audioData: 'dGVzdA==',
          durationSeconds: 0.3,
          wordId: '11111111-1111-1111-1111-111111111111',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('RECORDING_TOO_SHORT');
    });

    it('returns 400 when recording is too long (> 15s)', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          audioData: 'dGVzdA==',
          durationSeconds: 16,
          wordId: '11111111-1111-1111-1111-111111111111',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('RECORDING_TOO_LONG');
    });

    it('accepts recording at minimum duration (0.5s)', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          audioData: 'dGVzdA==',
          durationSeconds: 0.5,
          wordId: '11111111-1111-1111-1111-111111111111',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });

    it('accepts recording at maximum duration (15s)', async () => {
      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        createMockDbClient(),
      );

      const event = createMockEvent({
        body: JSON.stringify({
          audioData: 'dGVzdA==',
          durationSeconds: 15,
          wordId: '11111111-1111-1111-1111-111111111111',
          subjectId: '22222222-2222-2222-2222-222222222222',
        }),
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('successful recording flow', () => {
    it('uploads to S3, transcribes, scores, and returns result', async () => {
      const aiGateway = createMockAiGateway();
      const s3Client = createMockS3Client();
      const dbClient = createMockDbClient();

      const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

      const event = createMockEvent({ body: validRequestBody() });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(body.accuracyScore).toBeLessThanOrEqual(100);
      expect(body.syllableResults).toBeInstanceOf(Array);
      expect(body.s3Key).toContain('recordings/');
      expect(body.word).toBe('hello');

      // Verify S3 upload was called
      expect(s3Client.upload).toHaveBeenCalledTimes(1);
      // Verify AI Gateway was called for transcription
      expect(aiGateway.process).toHaveBeenCalledTimes(1);
      // Verify exercise result was saved
      expect(dbClient.saveExerciseResult).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when word is not found', async () => {
      const dbClient: PronunciationDbClient = {
        getWord: vi.fn().mockResolvedValue(null),
        saveExerciseResult: vi.fn(),
      };

      const handler = createUploadRecordingHandler(
        createMockAiGateway(),
        createMockS3Client(),
        dbClient,
      );

      const event = createMockEvent({ body: validRequestBody() });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).errorCode).toBe('WORD_NOT_FOUND');
    });
  });
});

describe('buildRecordingS3Key', () => {
  it('builds correct S3 key pattern', () => {
    const key = buildRecordingS3Key('student-abc', 'subject-xyz', 1700000000000);
    expect(key).toBe('recordings/student-abc/subject-xyz/1700000000000.webm');
  });
});

describe('computeAudioRequestHash', () => {
  it('produces consistent hash for same input', () => {
    const hash1 = computeAudioRequestHash('audiodata123');
    const hash2 = computeAudioRequestHash('audiodata123');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different input', () => {
    const hash1 = computeAudioRequestHash('audiodata123');
    const hash2 = computeAudioRequestHash('differentaudio');
    expect(hash1).not.toBe(hash2);
  });
});

describe('computeSyllableAccuracy', () => {
  it('returns 100 when transcription matches all syllables', () => {
    const result = computeSyllableAccuracy('hello', 'hello', ['hel', 'lo']);
    expect(result.accuracyScore).toBe(100);
    expect(result.syllableResults).toHaveLength(2);
    expect(result.syllableResults[0].isCorrect).toBe(true);
    expect(result.syllableResults[1].isCorrect).toBe(true);
  });

  it('returns 0 when transcription matches no syllables', () => {
    const result = computeSyllableAccuracy('xyz', 'hello', ['hel', 'lo']);
    expect(result.accuracyScore).toBe(0);
    expect(result.syllableResults.every((s) => !s.isCorrect)).toBe(true);
  });

  it('returns 50 when half the syllables match', () => {
    const result = computeSyllableAccuracy('hel world', 'hello', ['hel', 'lo']);
    expect(result.accuracyScore).toBe(50);
    expect(result.syllableResults[0].isCorrect).toBe(true);
    expect(result.syllableResults[1].isCorrect).toBe(false);
  });

  it('handles empty syllables array with whole-word comparison', () => {
    const result = computeSyllableAccuracy('hello', 'hello', []);
    expect(result.accuracyScore).toBe(100);
    expect(result.syllableResults).toHaveLength(1);
    expect(result.syllableResults[0].isCorrect).toBe(true);
  });

  it('is case-insensitive', () => {
    const result = computeSyllableAccuracy('HEL LO', 'hello', ['hel', 'lo']);
    expect(result.accuracyScore).toBe(100);
  });
});

describe('constants', () => {
  it('MIN_RECORDING_DURATION_SECONDS is 0.5', () => {
    expect(MIN_RECORDING_DURATION_SECONDS).toBe(0.5);
  });

  it('MAX_RECORDING_DURATION_SECONDS is 15', () => {
    expect(MAX_RECORDING_DURATION_SECONDS).toBe(15);
  });
});
