import { describe, it, expect, vi } from 'vitest';
import {
  createGetReferenceAudioHandler,
  buildReferenceTtsCacheKey,
  computeReferenceTtsRequestHash,
  buildCdnUrl,
} from './getReferenceAudio';
import type {
  TtsAiGatewayClient,
  ReferenceAudioDbClient,
  ReferenceWordRecord,
  CdnConfig,
} from './getReferenceAudio';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: { wordId: '11111111-1111-1111-1111-111111111111' },
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: 'student-123' },
      },
    },
    httpMethod: 'GET',
    path: '/pronunciation/reference/11111111-1111-1111-1111-111111111111',
    resource: '/pronunciation/reference/{wordId}',
    ...overrides,
  };
}

function createMockAiGateway(): TtsAiGatewayClient {
  return {
    process: vi.fn().mockResolvedValue({
      cached: false,
      data: {},
      s3AssetKey: 'audio/pronunciation/ref-word-123.mp3',
      cdnUrl: 'https://cdn.example.com/audio/pronunciation/ref-word-123.mp3',
    }),
  };
}

const defaultWordRecord: ReferenceWordRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  subjectId: '22222222-2222-2222-2222-222222222222',
  word: 'namaste',
  phoneticTranscription: 'nəˈmʌsteɪ',
  syllables: ['na', 'mas', 'te'],
  referenceAudioS3Key: null,
  language: 'hindi',
};

function createMockDbClient(wordRecord: ReferenceWordRecord | null = null): ReferenceAudioDbClient {
  return {
    getWord: vi.fn().mockResolvedValue(wordRecord || defaultWordRecord),
    updateReferenceAudioKey: vi.fn().mockResolvedValue(undefined),
  };
}

const defaultCdnConfig: CdnConfig = {
  baseUrl: 'https://d1234abc.cloudfront.net',
};

// ============================================================
// Tests
// ============================================================

describe('createGetReferenceAudioHandler', () => {
  describe('parameter validation', () => {
    it('returns 400 when wordId is missing', async () => {
      const handler = createGetReferenceAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
        defaultCdnConfig,
      );

      const event = createMockEvent({ pathParameters: {} });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 when wordId is not a valid UUID', async () => {
      const handler = createGetReferenceAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
        defaultCdnConfig,
      );

      const event = createMockEvent({ pathParameters: { wordId: 'not-a-uuid' } });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when word is not found', async () => {
      const dbClient: ReferenceAudioDbClient = {
        getWord: vi.fn().mockResolvedValue(null),
        updateReferenceAudioKey: vi.fn(),
      };

      const handler = createGetReferenceAudioHandler(
        createMockAiGateway(),
        dbClient,
        defaultCdnConfig,
      );

      const event = createMockEvent();
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).errorCode).toBe('WORD_NOT_FOUND');
    });
  });

  describe('generate-once pattern (Req 20.4)', () => {
    it('returns cached CDN URL when reference audio already exists', async () => {
      const wordWithAudio: ReferenceWordRecord = {
        ...defaultWordRecord,
        referenceAudioS3Key: 'audio/pronunciation/namaste.mp3',
      };

      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(wordWithAudio);
      const handler = createGetReferenceAudioHandler(aiGateway, dbClient, defaultCdnConfig);

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.audioUrl).toBe(
        'https://d1234abc.cloudfront.net/audio/pronunciation/namaste.mp3',
      );
      expect(body.word).toBe('namaste');
      expect(body.language).toBe('hindi');

      // AI Gateway should NOT have been called (generate-once)
      expect(aiGateway.process).not.toHaveBeenCalled();
    });

    it('generates audio via AI Gateway when no reference audio exists', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();
      const handler = createGetReferenceAudioHandler(aiGateway, dbClient, defaultCdnConfig);

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.audioUrl).toBe(
        'https://cdn.example.com/audio/pronunciation/ref-word-123.mp3',
      );

      // AI Gateway should have been called
      expect(aiGateway.process).toHaveBeenCalledTimes(1);
      expect(aiGateway.process).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceType: 'tts',
          payload: expect.objectContaining({
            text: 'namaste',
            language: 'hindi',
          }),
        }),
      );

      // DB should be updated with S3 key
      expect(dbClient.updateReferenceAudioKey).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'audio/pronunciation/ref-word-123.mp3',
      );
    });

    it('returns 500 when TTS generation fails to return asset info', async () => {
      const aiGateway: TtsAiGatewayClient = {
        process: vi.fn().mockResolvedValue({
          cached: false,
          data: {},
          s3AssetKey: undefined,
          cdnUrl: undefined,
        }),
      };

      const handler = createGetReferenceAudioHandler(
        aiGateway,
        createMockDbClient(),
        defaultCdnConfig,
      );

      const event = createMockEvent();
      const result = await handler(event);
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).errorCode).toBe('TTS_GENERATION_FAILED');
    });
  });

  describe('response format', () => {
    it('includes word metadata in the response', async () => {
      const wordWithAudio: ReferenceWordRecord = {
        ...defaultWordRecord,
        referenceAudioS3Key: 'audio/pronunciation/namaste.mp3',
      };

      const handler = createGetReferenceAudioHandler(
        createMockAiGateway(),
        createMockDbClient(wordWithAudio),
        defaultCdnConfig,
      );

      const event = createMockEvent();
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.word).toBe('namaste');
      expect(body.language).toBe('hindi');
      expect(body.phoneticTranscription).toBe('nəˈmʌsteɪ');
      expect(body.syllables).toEqual(['na', 'mas', 'te']);
    });
  });
});

describe('buildReferenceTtsCacheKey', () => {
  it('builds correct cache key pattern', () => {
    const key = buildReferenceTtsCacheKey('word-123');
    expect(key).toBe('pronunciation:reference:word-123:tts');
  });
});

describe('computeReferenceTtsRequestHash', () => {
  it('produces consistent hash for same input', () => {
    const hash1 = computeReferenceTtsRequestHash('hello', 'english');
    const hash2 = computeReferenceTtsRequestHash('hello', 'english');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different words', () => {
    const hash1 = computeReferenceTtsRequestHash('hello', 'english');
    const hash2 = computeReferenceTtsRequestHash('world', 'english');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different languages', () => {
    const hash1 = computeReferenceTtsRequestHash('hello', 'english');
    const hash2 = computeReferenceTtsRequestHash('hello', 'hindi');
    expect(hash1).not.toBe(hash2);
  });
});

describe('buildCdnUrl', () => {
  it('combines base URL and S3 key correctly', () => {
    const url = buildCdnUrl('https://cdn.example.com', 'audio/file.mp3');
    expect(url).toBe('https://cdn.example.com/audio/file.mp3');
  });

  it('handles trailing slash on base URL', () => {
    const url = buildCdnUrl('https://cdn.example.com/', 'audio/file.mp3');
    expect(url).toBe('https://cdn.example.com/audio/file.mp3');
  });

  it('handles leading slash on S3 key', () => {
    const url = buildCdnUrl('https://cdn.example.com', '/audio/file.mp3');
    expect(url).toBe('https://cdn.example.com/audio/file.mp3');
  });
});
