/**
 * Error handling for the Pronunciation Engine.
 *
 * Handles:
 * - Microphone access failure and low audio level
 * - Audio playback failure with retry option
 * - Graceful degradation when some assets fail to load
 *
 * Requirements: 2.6, 2.7, 2.9
 */

import { PronunciationAssetConfig } from '@chikumiku/service-core';

// --- Types ---

/** Microphone access status */
export type MicrophoneStatus = 'granted' | 'denied' | 'unavailable' | 'unknown';

/** Audio playback status */
export type PlaybackStatus = 'ready' | 'playing' | 'failed' | 'no_output' | 'missing_data';

/** Error response following the platform error format */
export interface PronunciationError {
  code: string;
  message: string;
  suggestedAction: string;
  retryable: boolean;
}

/** Result of checking microphone access */
export interface MicrophoneCheckResult {
  available: boolean;
  status: MicrophoneStatus;
  error?: PronunciationError;
}

/** Result of attempting audio playback */
export interface PlaybackResult {
  success: boolean;
  status: PlaybackStatus;
  error?: PronunciationError;
}

/** An alphabet entry with its asset loading status */
export interface AlphabetAssetStatus {
  character: string;
  transliteration: string;
  audioAvailable: boolean;
  /** Whether the asset was successfully loaded */
  loaded: boolean;
  /** Error message if loading failed */
  loadError?: string;
}

/** Result of loading pronunciation assets with graceful degradation */
export interface AssetLoadResult {
  /** Total number of alphabet entries */
  totalEntries: number;
  /** Number of entries with successfully loaded assets */
  loadedEntries: number;
  /** Number of entries that failed to load */
  failedEntries: number;
  /** Entries available for practice */
  availableForPractice: AlphabetAssetStatus[];
  /** Entries unavailable due to loading failures */
  unavailableEntries: AlphabetAssetStatus[];
  /** Whether at least some entries are available for practice */
  canPractice: boolean;
  /** Warning message if some assets failed */
  warning?: string;
}

// --- Microphone Error Handling ---

/**
 * Checks microphone access and returns appropriate error if unavailable.
 *
 * Requirements: 2.6
 */
export function checkMicrophoneAccess(status: MicrophoneStatus): MicrophoneCheckResult {
  switch (status) {
    case 'granted':
      return { available: true, status };

    case 'denied':
      return {
        available: false,
        status,
        error: {
          code: 'MICROPHONE_ACCESS_DENIED',
          message: 'Microphone access is not allowed. Please enable microphone permissions to record your pronunciation.',
          suggestedAction: 'Go to your device settings and allow microphone access for this app.',
          retryable: true,
        },
      };

    case 'unavailable':
      return {
        available: false,
        status,
        error: {
          code: 'MICROPHONE_UNAVAILABLE',
          message: 'No microphone was found on this device. A microphone is needed to practice pronunciation.',
          suggestedAction: 'Connect a microphone or headset to your device and try again.',
          retryable: true,
        },
      };

    case 'unknown':
    default:
      return {
        available: false,
        status: 'unknown',
        error: {
          code: 'MICROPHONE_STATUS_UNKNOWN',
          message: 'Unable to check microphone access. Please try again.',
          suggestedAction: 'Check your microphone permissions and try again.',
          retryable: true,
        },
      };
  }
}

/**
 * Checks if the audio level is sufficient for pronunciation detection.
 * Returns an error if the level is below the minimum threshold.
 *
 * Requirements: 2.6
 */
export function checkAudioLevel(
  audioLevel: number,
  minimumThreshold: number = 0.01
): PronunciationError | null {
  if (audioLevel < minimumThreshold) {
    return {
      code: 'LOW_AUDIO_LEVEL',
      message: 'The recorded audio level is too low. Please speak louder or move closer to the microphone.',
      suggestedAction: 'Speak louder or check that your microphone is not muted.',
      retryable: true,
    };
  }
  return null;
}

// --- Audio Playback Error Handling ---

/**
 * Handles audio playback failure and provides retry option.
 *
 * Requirements: 2.7
 */
export function handlePlaybackFailure(status: PlaybackStatus): PlaybackResult {
  switch (status) {
    case 'ready':
    case 'playing':
      return { success: true, status };

    case 'no_output':
      return {
        success: false,
        status,
        error: {
          code: 'AUDIO_OUTPUT_UNAVAILABLE',
          message: 'Audio playback failed because no audio output device was found.',
          suggestedAction: 'Check that your speakers or headphones are connected and try again.',
          retryable: true,
        },
      };

    case 'missing_data':
      return {
        success: false,
        status,
        error: {
          code: 'AUDIO_DATA_MISSING',
          message: 'The pronunciation audio could not be loaded. The audio file may be temporarily unavailable.',
          suggestedAction: 'Tap retry to attempt loading the audio again.',
          retryable: true,
        },
      };

    case 'failed':
    default:
      return {
        success: false,
        status: 'failed',
        error: {
          code: 'PLAYBACK_FAILED',
          message: 'Audio playback failed. Please try again.',
          suggestedAction: 'Tap retry to play the pronunciation again.',
          retryable: true,
        },
      };
  }
}

// --- Asset Loading with Graceful Degradation ---

/**
 * Loads pronunciation assets and gracefully degrades when some fail.
 *
 * - Attempts to load all alphabet entries from the pronunciation assets
 * - Marks entries that fail to load as unavailable
 * - Allows practice with available entries
 * - Visually indicates which letters are temporarily unavailable
 *
 * Requirements: 2.9
 */
export function loadPronunciationAssets(
  pronunciationAssets: PronunciationAssetConfig,
  failedCharacters: string[] = []
): AssetLoadResult {
  const allEntries: AlphabetAssetStatus[] = pronunciationAssets.alphabetSet.map(entry => {
    const isFailed = failedCharacters.includes(entry.character);

    return {
      character: entry.character,
      transliteration: entry.transliteration,
      audioAvailable: entry.audioAvailable,
      loaded: !isFailed && entry.audioAvailable,
      loadError: isFailed
        ? `Failed to load audio for "${entry.character}". This letter is temporarily unavailable for pronunciation practice.`
        : undefined,
    };
  });

  const availableForPractice = allEntries.filter(e => e.loaded);
  const unavailableEntries = allEntries.filter(e => !e.loaded);

  const totalEntries = allEntries.length;
  const loadedEntries = availableForPractice.length;
  const failedEntries = unavailableEntries.length;
  const canPractice = loadedEntries > 0;

  let warning: string | undefined;
  if (failedEntries > 0 && canPractice) {
    warning = `${failedEntries} of ${totalEntries} letters are temporarily unavailable for pronunciation practice. You can still practice with the ${loadedEntries} available letters.`;
  } else if (!canPractice) {
    warning = 'No pronunciation assets are currently available. Please try again later.';
  }

  return {
    totalEntries,
    loadedEntries,
    failedEntries,
    availableForPractice,
    unavailableEntries,
    canPractice,
    warning,
  };
}
