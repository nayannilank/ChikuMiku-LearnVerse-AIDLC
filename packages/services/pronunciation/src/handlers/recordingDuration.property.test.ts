/**
 * Property Test: Recording Duration Validation
 *
 * Property 18: For any audio recording with duration less than 0.5 seconds or greater
 * than 15 seconds, the system SHALL return an error indicating invalid recording duration;
 * recordings between 0.5 and 15 seconds (inclusive) SHALL be accepted.
 *
 * **Validates: Requirements 12.4, 20.6**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createUploadRecordingHandler,
  MIN_RECORDING_DURATION_SECONDS,
  MAX_RECORDING_DURATION_SECONDS,
  type WhisperAiGatewayClient,
  type RecordingS3Client,
  type PronunciationDbClient,
} from './uploadRecording';

// ============================================================
// Test Helpers
// ============================================================

const VALID_UUID = '11111111-2222-3333-4444-555555555555';
const VALID_WORD_ID = '22222222-3333-4444-5555-666666666666';
const VALID_SUBJECT_ID = '33333333-4444-5555-6666-777777777777';

/**
 * Creates a mock API Gateway event with a given duration.
 */
function makeEventWithDuration(durationSeconds: number) {
  return {
    body: JSON.stringify({
      audioData: Buffer.from('fake-audio-data').toString('base64'),
      durationSeconds,
      wordId: VALID_WORD_ID,
      subjectId: VALID_SUBJECT_ID,
    }),
    requestContext: {
      authorizer: {
        claims: { sub: VALID_UUID },
      },
    },
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/pronunciation/record',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
  } as any;
}

/**
 * Creates stub dependencies that resolve successfully (for valid duration tests).
 */
function makeStubDependencies() {
  const aiGateway: WhisperAiGatewayClient = {
    process: async () => ({
      cached: false,
      data: { transcription: 'hello' },
    }),
  };

  const s3Client: RecordingS3Client = {
    upload: async (key) => key,
  };

  const dbClient: PronunciationDbClient = {
    getWord: async () => ({
      id: VALID_WORD_ID,
      subjectId: VALID_SUBJECT_ID,
      word: 'hello',
      phoneticTranscription: null,
      syllables: ['hel', 'lo'],
      referenceAudioS3Key: null,
      language: 'en',
    }),
    saveExerciseResult: async () => {},
  };

  return { aiGateway, s3Client, dbClient };
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 18: Recording Duration Validation', () => {
  it('durations below 0.5s are rejected with RECORDING_TOO_SHORT', async () => {
    const { aiGateway, s3Client, dbClient } = makeStubDependencies();
    const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

    await fc.assert(
      fc.asyncProperty(
        // Generate durations in [0, 0.5) — exclusive of 0.5
        fc.double({ min: 0, max: 0.4999999, noNaN: true }),
        async (duration) => {
          const event = makeEventWithDuration(duration);
          const result = await handler(event);
          const body = JSON.parse(result!.body);

          expect(result!.statusCode).toBe(400);
          expect(body.success).toBe(false);
          expect(body.errorCode).toBe('RECORDING_TOO_SHORT');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('durations above 15s are rejected with RECORDING_TOO_LONG', async () => {
    const { aiGateway, s3Client, dbClient } = makeStubDependencies();
    const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

    await fc.assert(
      fc.asyncProperty(
        // Generate durations in (15, 30] — exclusive of 15
        fc.double({ min: 15.0000001, max: 30, noNaN: true }),
        async (duration) => {
          const event = makeEventWithDuration(duration);
          const result = await handler(event);
          const body = JSON.parse(result!.body);

          expect(result!.statusCode).toBe(400);
          expect(body.success).toBe(false);
          expect(body.errorCode).toBe('RECORDING_TOO_LONG');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('durations in [0.5, 15] (inclusive) are accepted without duration errors', async () => {
    const { aiGateway, s3Client, dbClient } = makeStubDependencies();
    const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

    await fc.assert(
      fc.asyncProperty(
        // Generate durations in [0.5, 15] — inclusive on both ends
        fc.double({ min: 0.5, max: 15, noNaN: true }),
        async (duration) => {
          const event = makeEventWithDuration(duration);
          const result = await handler(event);
          const body = JSON.parse(result!.body);

          // Should NOT be a duration-related error
          expect(body.errorCode).not.toBe('RECORDING_TOO_SHORT');
          expect(body.errorCode).not.toBe('RECORDING_TOO_LONG');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('boundary: exactly 0.5s is accepted (minimum inclusive)', async () => {
    const { aiGateway, s3Client, dbClient } = makeStubDependencies();
    const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

    await fc.assert(
      fc.asyncProperty(fc.constant(MIN_RECORDING_DURATION_SECONDS), async (duration) => {
        const event = makeEventWithDuration(duration);
        const result = await handler(event);
        const body = JSON.parse(result!.body);

        expect(body.errorCode).not.toBe('RECORDING_TOO_SHORT');
        expect(body.errorCode).not.toBe('RECORDING_TOO_LONG');
      }),
      { numRuns: 1 },
    );
  });

  it('boundary: exactly 15s is accepted (maximum inclusive)', async () => {
    const { aiGateway, s3Client, dbClient } = makeStubDependencies();
    const handler = createUploadRecordingHandler(aiGateway, s3Client, dbClient);

    await fc.assert(
      fc.asyncProperty(fc.constant(MAX_RECORDING_DURATION_SECONDS), async (duration) => {
        const event = makeEventWithDuration(duration);
        const result = await handler(event);
        const body = JSON.parse(result!.body);

        expect(body.errorCode).not.toBe('RECORDING_TOO_SHORT');
        expect(body.errorCode).not.toBe('RECORDING_TOO_LONG');
      }),
      { numRuns: 1 },
    );
  });

  it('constants match expected values', () => {
    expect(MIN_RECORDING_DURATION_SECONDS).toBe(0.5);
    expect(MAX_RECORDING_DURATION_SECONDS).toBe(15);
  });
});
