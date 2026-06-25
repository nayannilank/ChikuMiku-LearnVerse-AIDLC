/**
 * Pronunciation Handlers Barrel Export
 */

export {
  createUploadRecordingHandler,
  buildRecordingS3Key,
  computeAudioRequestHash,
  computeSyllableAccuracy,
  MIN_RECORDING_DURATION_SECONDS,
  MAX_RECORDING_DURATION_SECONDS as UPLOAD_MAX_RECORDING_DURATION_SECONDS,
  SYLLABLE_CORRECT_THRESHOLD,
} from './uploadRecording';
export type {
  WhisperAiGatewayClient,
  WhisperGatewayResponse,
  RecordingS3Client,
  PronunciationDbClient,
  PronunciationWordRecord,
  ExerciseResultRecord,
  UploadRecordingRequest,
  UploadRecordingSuccessResponse,
  UploadRecordingErrorResponse,
  SyllableResultResponse,
} from './uploadRecording';

export {
  createGetReferenceAudioHandler,
  buildReferenceTtsCacheKey,
  computeReferenceTtsRequestHash,
  buildCdnUrl,
} from './getReferenceAudio';
export type {
  TtsAiGatewayClient,
  TtsGatewayResponse,
  ReferenceAudioDbClient,
  ReferenceWordRecord,
  CdnConfig,
  GetReferenceAudioSuccessResponse,
  GetReferenceAudioErrorResponse,
} from './getReferenceAudio';
