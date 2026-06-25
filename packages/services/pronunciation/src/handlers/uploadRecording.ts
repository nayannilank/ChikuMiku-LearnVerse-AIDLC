/**
 * Upload Recording Handler
 *
 * POST /pronunciation/record
 *
 * Accepts an audio recording of a student's pronunciation attempt.
 * Uploads audio to S3 (key: studentId + subject + timestamp),
 * invokes Whisper transcription via AI Gateway, compares to expected word,
 * and calculates syllable-level accuracy score (0-100).
 *
 * Validates recording duration (0.5s–15s) and returns result within 5 seconds.
 *
 * Requirements: 12.3, 12.4, 12.5, 12.6, 20.1, 20.5, 20.6
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

import { createHash } from 'crypto';

// ============================================================
// Types
// ============================================================

export interface UploadRecordingRequest {
  /** Base64-encoded audio data */
  audioData: string;
  /** Duration of the recording in seconds */
  durationSeconds: number;
  /** The word ID being practiced */
  wordId: string;
  /** The subject ID for S3 key construction */
  subjectId: string;
}

export interface SyllableResultResponse {
  /** The syllable text */
  syllable: string;
  /** Whether this syllable was pronounced correctly */
  isCorrect: boolean;
}

export interface UploadRecordingSuccessResponse {
  success: true;
  /** Overall accuracy score 0-100 */
  accuracyScore: number;
  /** Per-syllable correctness results */
  syllableResults: SyllableResultResponse[];
  /** S3 key where the recording was stored */
  s3Key: string;
  /** The word that was evaluated */
  word: string;
}

export interface UploadRecordingErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface WhisperAiGatewayClient {
  /**
   * Invokes Whisper transcription via the AI Gateway.
   * Returns the transcribed text from the audio.
   */
  process(request: {
    cacheKey: string;
    serviceType: 'transcription';
    requestHash: string;
    payload: Record<string, unknown>;
  }): Promise<WhisperGatewayResponse>;
}

export interface WhisperGatewayResponse {
  cached: boolean;
  data: {
    transcription?: string;
    [key: string]: unknown;
  };
  s3AssetKey?: string;
  cdnUrl?: string;
}

export interface RecordingS3Client {
  /**
   * Uploads audio data to S3 with the given key.
   * Returns the full S3 key.
   */
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
}

export interface PronunciationDbClient {
  /** Gets a pronunciation word by ID */
  getWord(wordId: string): Promise<PronunciationWordRecord | null>;
  /** Records the exercise result */
  saveExerciseResult(result: ExerciseResultRecord): Promise<void>;
}

export interface PronunciationWordRecord {
  id: string;
  subjectId: string;
  word: string;
  phoneticTranscription: string | null;
  syllables: string[];
  referenceAudioS3Key: string | null;
  language: string;
}

export interface ExerciseResultRecord {
  studentId: string;
  wordId: string;
  subjectId: string;
  score: number;
  syllableResults: SyllableResultResponse[];
  s3Key: string;
}

// ============================================================
// Constants
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimum recording duration in seconds */
export const MIN_RECORDING_DURATION_SECONDS = 0.5;

/** Maximum recording duration in seconds */
export const MAX_RECORDING_DURATION_SECONDS = 15;

/** Threshold above which a syllable is considered correct */
export const SYLLABLE_CORRECT_THRESHOLD = 0.7;

// ============================================================
// Helpers
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Builds a unique S3 key for a recording.
 * Pattern: recordings/{studentId}/{subjectId}/{timestamp}.webm
 */
export function buildRecordingS3Key(
  studentId: string,
  subjectId: string,
  timestamp: number,
): string {
  return `recordings/${studentId}/${subjectId}/${timestamp}.webm`;
}

/**
 * Computes SHA-256 hash of audio data for cache/request tracking.
 */
export function computeAudioRequestHash(audioData: string): string {
  return createHash('sha256').update(audioData).digest('hex');
}

/**
 * Compares the Whisper transcription against expected syllables
 * and produces syllable-level accuracy results.
 *
 * Uses simple string matching / substring presence to determine
 * per-syllable correctness and compute an overall 0-100 score.
 */
export function computeSyllableAccuracy(
  transcription: string,
  expectedWord: string,
  syllables: string[],
): { accuracyScore: number; syllableResults: SyllableResultResponse[] } {
  if (syllables.length === 0) {
    // No syllable breakdown available — do whole-word comparison
    const normalizedTranscription = transcription.toLowerCase().trim();
    const normalizedExpected = expectedWord.toLowerCase().trim();
    const isCorrect = normalizedTranscription === normalizedExpected;
    return {
      accuracyScore: isCorrect ? 100 : 0,
      syllableResults: [{ syllable: expectedWord, isCorrect }],
    };
  }

  const normalizedTranscription = transcription.toLowerCase().trim();
  const syllableResults: SyllableResultResponse[] = [];
  let correctCount = 0;

  for (const syllable of syllables) {
    const normalizedSyllable = syllable.toLowerCase().trim();
    // Check if the syllable sounds appear in the transcription
    const isCorrect = normalizedTranscription.includes(normalizedSyllable);
    syllableResults.push({ syllable, isCorrect });
    if (isCorrect) {
      correctCount++;
    }
  }

  // Calculate accuracy as percentage of correct syllables
  const accuracyScore = Math.round((correctCount / syllables.length) * 100);

  return { accuracyScore, syllableResults };
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates an uploadRecording Lambda handler with injected dependencies.
 *
 * The handler:
 * 1. Validates request body (audioData, durationSeconds, wordId, subjectId)
 * 2. Validates recording duration (0.5s–15s)
 * 3. Uploads audio to S3 with key: studentId + subjectId + timestamp
 * 4. Invokes Whisper transcription via AI Gateway
 * 5. Compares transcription to expected word's syllables
 * 6. Calculates syllable-level accuracy score (0-100)
 * 7. Saves exercise result to database
 * 8. Returns accuracy score and syllable results
 *
 * Requirements: 12.3, 12.4, 12.5, 12.6, 20.1, 20.5, 20.6
 */
export function createUploadRecordingHandler(
  aiGateway: WhisperAiGatewayClient,
  s3Client: RecordingS3Client,
  dbClient: PronunciationDbClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // 1. Extract student ID from JWT claims
      const studentId = event.requestContext?.authorizer?.claims?.sub;
      if (!studentId) {
        return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // 2. Parse and validate request body
      if (!event.body) {
        return errorResponse(400, 'MISSING_BODY', 'Request body is required');
      }

      let body: UploadRecordingRequest;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      const { audioData, durationSeconds, wordId, subjectId } = body;

      // 3. Validate required fields
      if (!audioData || audioData.trim().length === 0) {
        return errorResponse(400, 'MISSING_AUDIO', 'audioData is required');
      }

      if (durationSeconds === undefined || durationSeconds === null) {
        return errorResponse(400, 'MISSING_DURATION', 'durationSeconds is required');
      }

      if (!wordId || !isValidUUID(wordId)) {
        return errorResponse(400, 'INVALID_WORD_ID', 'Valid wordId is required');
      }

      if (!subjectId || !isValidUUID(subjectId)) {
        return errorResponse(400, 'INVALID_SUBJECT_ID', 'Valid subjectId is required');
      }

      // 4. Validate recording duration (Requirement 12.4, 20.6)
      if (durationSeconds < MIN_RECORDING_DURATION_SECONDS) {
        return errorResponse(
          400,
          'RECORDING_TOO_SHORT',
          `Recording duration (${durationSeconds.toFixed(2)}s) is below the minimum of ${MIN_RECORDING_DURATION_SECONDS} seconds`,
        );
      }

      if (durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
        return errorResponse(
          400,
          'RECORDING_TOO_LONG',
          `Recording duration (${durationSeconds.toFixed(2)}s) exceeds the maximum of ${MAX_RECORDING_DURATION_SECONDS} seconds`,
        );
      }

      // 5. Look up the pronunciation word (Requirement 12.3)
      const wordRecord = await dbClient.getWord(wordId);
      if (!wordRecord) {
        return errorResponse(404, 'WORD_NOT_FOUND', `Pronunciation word ${wordId} not found`);
      }

      // 6. Upload audio to S3 (Requirement 20.1)
      const timestamp = Date.now();
      const s3Key = buildRecordingS3Key(studentId, subjectId, timestamp);
      const audioBuffer = Buffer.from(audioData, 'base64');
      await s3Client.upload(s3Key, audioBuffer, 'audio/webm');

      // 7. Invoke Whisper transcription via AI Gateway (Requirement 20.5)
      const requestHash = computeAudioRequestHash(audioData);
      const cacheKey = `pronunciation:${studentId}:${wordId}:${timestamp}`;

      const whisperResponse = await aiGateway.process({
        cacheKey,
        serviceType: 'transcription',
        requestHash,
        payload: {
          audioData,
          language: wordRecord.language,
          expectedWord: wordRecord.word,
        },
      });

      const transcription = (whisperResponse.data.transcription as string) || '';

      // 8. Compute syllable-level accuracy (Requirements 12.5, 12.6)
      const { accuracyScore, syllableResults } = computeSyllableAccuracy(
        transcription,
        wordRecord.word,
        wordRecord.syllables,
      );

      // 9. Save exercise result to database
      await dbClient.saveExerciseResult({
        studentId,
        wordId,
        subjectId,
        score: accuracyScore,
        syllableResults,
        s3Key,
      });

      // 10. Return success response
      const response: UploadRecordingSuccessResponse = {
        success: true,
        accuracyScore,
        syllableResults,
        s3Key,
        word: wordRecord.word,
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred while processing the recording',
      );
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: UploadRecordingErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
