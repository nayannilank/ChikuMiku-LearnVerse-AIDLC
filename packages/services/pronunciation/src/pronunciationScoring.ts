/**
 * Pronunciation scoring engine.
 *
 * Accepts recordings up to 10 seconds, compares against correct pronunciation,
 * produces accuracy score 0-100 with syllable-level feedback, and loads
 * correct pronunciation rules per active language subject.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.8
 */

import { PronunciationAssetConfig, SubjectModule } from '@chikumiku/service-core';

// --- Constants ---

/** Maximum recording duration in seconds */
export const MAX_RECORDING_DURATION_SECONDS = 10;

/** Minimum acceptable score threshold */
export const MIN_SCORE = 0;

/** Maximum score */
export const MAX_SCORE = 100;

// --- Types ---

/** Audio recording input from the learner */
export interface AudioRecording {
  /** Raw audio data */
  data: Uint8Array;
  /** Duration in seconds */
  durationSeconds: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Audio level (0-1 range, where 0 is silence) */
  audioLevel: number;
}

/** Score for an individual syllable */
export interface SyllableScore {
  /** The target syllable */
  syllable: string;
  /** Score for this syllable (0-100) */
  score: number;
  /** Whether this syllable was pronounced correctly (score >= 70) */
  isCorrect: boolean;
  /** Feedback for this syllable */
  feedback: string;
}

/** Complete pronunciation scoring result */
export interface PronunciationScoreResult {
  /** Overall accuracy score 0-100 */
  overallScore: number;
  /** Per-syllable scores */
  syllableScores: SyllableScore[];
  /** Human-readable feedback summary */
  feedback: string;
  /** The target word/character that was being pronounced */
  target: string;
  /** Language code */
  languageCode: string;
}

/** Error when scoring fails */
export interface PronunciationScoringError {
  success: false;
  error: string;
  code:
    | 'RECORDING_TOO_LONG'
    | 'EMPTY_RECORDING'
    | 'NOT_LANGUAGE_SUBJECT'
    | 'NO_PRONUNCIATION_ASSETS'
    | 'EMPTY_TARGET'
    | 'LOW_AUDIO_LEVEL';
}

/** Success result for pronunciation scoring */
export interface PronunciationScoringSuccess {
  success: true;
  result: PronunciationScoreResult;
}

export type PronunciationScoringResponse = PronunciationScoringSuccess | PronunciationScoringError;

// --- Validation ---

/**
 * Validates an audio recording input.
 */
export function validateRecording(recording: AudioRecording): string | null {
  if (!recording.data || recording.data.length === 0) {
    return 'Recording is empty. Please try recording again.';
  }

  if (recording.durationSeconds <= 0) {
    return 'Recording duration must be greater than 0 seconds.';
  }

  if (recording.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    return `Recording duration (${recording.durationSeconds.toFixed(1)}s) exceeds the maximum of ${MAX_RECORDING_DURATION_SECONDS} seconds.`;
  }

  return null;
}

// --- Scoring Logic ---

/**
 * Computes a simulated pronunciation score for a syllable based on audio data.
 *
 * In production, this would use speech recognition / phoneme comparison.
 * This implementation provides a deterministic score based on audio characteristics
 * for testing and development purposes.
 */
export function scoreSyllable(
  syllable: string,
  audioSegment: Uint8Array,
  _pronunciationAssets: PronunciationAssetConfig
): SyllableScore {
  // Simulate scoring based on audio data characteristics
  // In production, this would use actual speech recognition comparison
  if (audioSegment.length === 0) {
    return {
      syllable,
      score: 0,
      isCorrect: false,
      feedback: `Syllable "${syllable}" was not detected in the recording.`,
    };
  }

  // Calculate a score based on audio energy (simulated)
  let sum = 0;
  for (let i = 0; i < audioSegment.length; i++) {
    sum += audioSegment[i];
  }
  const avgEnergy = sum / audioSegment.length;

  // Normalize to 0-100 range
  const rawScore = Math.min(100, Math.round((avgEnergy / 255) * 100));

  // Clamp to valid range
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, rawScore));
  const isCorrect = score >= 70;

  let feedback: string;
  if (score >= 90) {
    feedback = `Excellent pronunciation of "${syllable}"!`;
  } else if (score >= 70) {
    feedback = `Good pronunciation of "${syllable}".`;
  } else if (score >= 50) {
    feedback = `Syllable "${syllable}" needs improvement. Try to match the correct pronunciation more closely.`;
  } else {
    feedback = `Syllable "${syllable}" was pronounced incorrectly. Listen to the correct pronunciation and try again.`;
  }

  return { syllable, score, isCorrect, feedback };
}

/**
 * Splits audio data into segments corresponding to syllables.
 * Divides the audio evenly across the number of syllables.
 */
export function splitAudioBySyllables(
  audioData: Uint8Array,
  syllableCount: number
): Uint8Array[] {
  if (syllableCount <= 0) return [];
  if (syllableCount === 1) return [audioData];

  const segmentSize = Math.floor(audioData.length / syllableCount);
  const segments: Uint8Array[] = [];

  for (let i = 0; i < syllableCount; i++) {
    const start = i * segmentSize;
    const end = i === syllableCount - 1 ? audioData.length : start + segmentSize;
    segments.push(audioData.slice(start, end));
  }

  return segments;
}

/**
 * Generates overall feedback based on the pronunciation score.
 */
export function generateFeedback(overallScore: number, incorrectSyllables: string[]): string {
  if (overallScore >= 90) {
    return 'Excellent pronunciation! Keep up the great work!';
  }

  if (overallScore >= 70) {
    if (incorrectSyllables.length > 0) {
      return `Good effort! Focus on improving: ${incorrectSyllables.join(', ')}.`;
    }
    return 'Good pronunciation! Keep practicing to improve further.';
  }

  if (overallScore >= 50) {
    return `Keep practicing! The following syllables need work: ${incorrectSyllables.join(', ')}.`;
  }

  return `Try listening to the correct pronunciation again and practice slowly. Focus on: ${incorrectSyllables.join(', ')}.`;
}

// --- Main Scoring Function ---

/**
 * Scores a learner's pronunciation attempt against the target word/character.
 *
 * - Validates the recording (duration, audio level)
 * - Loads pronunciation rules from the active language Subject Module
 * - Breaks the target into syllables
 * - Scores each syllable individually
 * - Produces an overall score 0-100 with syllable-level feedback
 *
 * Requirements: 2.1, 2.2, 2.3, 2.8
 */
export function scorePronunciation(
  recording: AudioRecording,
  target: string,
  subjectModule: SubjectModule
): PronunciationScoringResponse {
  // Validate target
  if (!target || target.trim().length === 0) {
    return {
      success: false,
      error: 'Target word or character cannot be empty.',
      code: 'EMPTY_TARGET',
    };
  }

  // Verify this is a language subject
  if (!subjectModule.renderingConfig.isLanguageSubject) {
    return {
      success: false,
      error: `Subject "${subjectModule.name}" is not a language subject. Pronunciation scoring is only available for language subjects.`,
      code: 'NOT_LANGUAGE_SUBJECT',
    };
  }

  // Verify pronunciation assets are available
  if (!subjectModule.pronunciationAssets) {
    return {
      success: false,
      error: `No pronunciation assets configured for subject "${subjectModule.name}".`,
      code: 'NO_PRONUNCIATION_ASSETS',
    };
  }

  // Validate recording is not empty
  if (!recording.data || recording.data.length === 0) {
    return {
      success: false,
      error: 'Recording is empty. Please try recording again.',
      code: 'EMPTY_RECORDING',
    };
  }

  // Validate recording duration
  if (recording.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    return {
      success: false,
      error: `Recording duration (${recording.durationSeconds.toFixed(1)}s) exceeds the maximum of ${MAX_RECORDING_DURATION_SECONDS} seconds. Please keep recordings under ${MAX_RECORDING_DURATION_SECONDS} seconds.`,
      code: 'RECORDING_TOO_LONG',
    };
  }

  // Check audio level
  if (recording.audioLevel <= 0) {
    return {
      success: false,
      error: 'Audio level is too low. Please speak louder or check your microphone.',
      code: 'LOW_AUDIO_LEVEL',
    };
  }

  const pronunciationAssets = subjectModule.pronunciationAssets;

  // Break target into syllables
  const syllables = pronunciationAssets.syllabify(target);

  // Split audio into segments for each syllable
  const audioSegments = splitAudioBySyllables(recording.data, syllables.length);

  // Score each syllable
  const syllableScores: SyllableScore[] = syllables.map((syllable, index) => {
    const segment = audioSegments[index] || new Uint8Array(0);
    return scoreSyllable(syllable, segment, pronunciationAssets);
  });

  // Calculate overall score as average of syllable scores
  const totalScore = syllableScores.reduce((sum, s) => sum + s.score, 0);
  const overallScore = syllableScores.length > 0
    ? Math.round(totalScore / syllableScores.length)
    : 0;

  // Clamp overall score to valid range
  const clampedScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, overallScore));

  // Identify incorrect syllables for feedback
  const incorrectSyllables = syllableScores
    .filter(s => !s.isCorrect)
    .map(s => s.syllable);

  const feedback = generateFeedback(clampedScore, incorrectSyllables);

  return {
    success: true,
    result: {
      overallScore: clampedScore,
      syllableScores,
      feedback,
      target,
      languageCode: pronunciationAssets.languageCode,
    },
  };
}
