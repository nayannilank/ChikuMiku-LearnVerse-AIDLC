/**
 * PronunciationScreen — Word pronunciation practice with recording and scoring.
 *
 * Displays a word at language-appropriate font size with phonetic transcription,
 * provides reference audio playback (TTS), recording with 10s max duration,
 * accuracy scoring with syllable-level color-coded feedback, and retry/next controls.
 *
 * UI States:
 * 1. Initial: Word + phonetic + play reference + record button
 * 2. Recording: Stop button + timer (max 10s auto-stop)
 * 3. Processing: Loading indicator while scoring
 * 4. Results: Accuracy %, syllable breakdown (green/red), retry + next
 * 5. Error: Microphone permission denied with instructions
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PronunciationWord, PronunciationResult, SyllableResult } from '@learnverse/platform-contracts';

// ============================================================
// Types & Interfaces
// ============================================================

export type PronunciationUIState = 'initial' | 'recording' | 'processing' | 'results' | 'error';
export type SupportedLanguage = 'kannada' | 'english' | 'hindi';

export interface PronunciationScreenProps {
  /** The word data to practice */
  word: PronunciationWord;
  /** Fetch reference audio URL for the word (Req 12.2) */
  fetchReferenceAudio: (wordId: string) => Promise<{ audioUrl: string }>;
  /** Upload recording and get scoring result (Req 12.5, 12.6) */
  submitRecording: (wordId: string, audioBlob: Blob) => Promise<PronunciationResult>;
  /** Navigate to next word (Req 12.9) */
  onNext: () => void;
  /** Optional: subject color for theming */
  subjectColor?: string;
}

// ============================================================
// Constants & Design Tokens
// ============================================================

const MAX_RECORDING_DURATION_MS = 10_000; // 10 seconds (Req 12.4)

const COLORS = {
  primary: '#E94F9B',
  background: '#F8F5FF',
  dark: '#2C2341',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  green: '#27AE60',
  red: '#E74C3C',
  errorBg: '#FDF2F2',
  lightPurple: '#F3E8FF',
} as const;

/** Language-specific font sizes (Req 12.1, Design System 3.2) */
const WORD_FONT_SIZES: Record<SupportedLanguage, string> = {
  english: '32px',
  hindi: '40px',
  kannada: '52px',
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Returns the correct font size for a given language.
 * English: 32px, Hindi: 40px, Kannada: 52px bold for Indic scripts.
 */
export function getWordFontSize(language: SupportedLanguage): string {
  return WORD_FONT_SIZES[language] ?? '32px';
}

/**
 * Formats elapsed milliseconds as "M:SS" timer display.
 */
export function formatTimer(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================
// Styles
// ============================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: COLORS.background,
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  } as React.CSSProperties,

  card: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '32px',
    width: '100%',
    maxWidth: '560px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '24px',
  } as React.CSSProperties,

  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 8px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  wordDisplay: (language: SupportedLanguage): React.CSSProperties => ({
    fontSize: getWordFontSize(language),
    fontWeight: 700,
    color: COLORS.dark,
    textAlign: 'center',
    margin: '16px 0 8px 0',
    lineHeight: 1.3,
  }),

  phoneticText: {
    fontSize: '16px',
    fontStyle: 'italic' as const,
    color: COLORS.muted,
    margin: '0 0 16px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  // Buttons
  primaryButton: (disabled: boolean): React.CSSProperties => ({
    padding: '14px 28px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: disabled ? COLORS.border : COLORS.primary,
    color: disabled ? COLORS.muted : COLORS.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s',
    minWidth: '140px',
  }),

  secondaryButton: (disabled: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    fontSize: '13px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '22px',
    backgroundColor: disabled ? COLORS.border : COLORS.white,
    color: disabled ? COLORS.muted : COLORS.dark,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s',
    minWidth: '120px',
  }),

  recordButton: {
    padding: '16px 32px',
    fontSize: '14px',
    fontWeight: 700,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.red,
    color: COLORS.white,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: '160px',
  } as React.CSSProperties,

  stopButton: {
    padding: '16px 32px',
    fontSize: '14px',
    fontWeight: 700,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.dark,
    color: COLORS.white,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: '160px',
  } as React.CSSProperties,

  playButton: {
    padding: '12px 24px',
    fontSize: '13px',
    fontWeight: 600,
    border: `2px solid ${COLORS.primary}`,
    borderRadius: '22px',
    backgroundColor: COLORS.white,
    color: COLORS.primary,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  // Timer display during recording
  timerDisplay: {
    fontSize: '24px',
    fontWeight: 700,
    color: COLORS.red,
    margin: '8px 0',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,

  // Results section
  accuracyContainer: {
    textAlign: 'center' as const,
    marginBottom: '16px',
  } as React.CSSProperties,

  accuracyScore: (score: number): React.CSSProperties => ({
    fontSize: '48px',
    fontWeight: 700,
    color: score >= 70 ? COLORS.green : score >= 40 ? '#F39C12' : COLORS.red,
    margin: '0',
    lineHeight: 1.2,
  }),

  accuracyLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.muted,
    margin: '4px 0 0 0',
  } as React.CSSProperties,

  syllableContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    justifyContent: 'center',
    margin: '16px 0',
  } as React.CSSProperties,

  syllableChip: (isCorrect: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '16px',
    fontWeight: 600,
    borderRadius: '10px',
    backgroundColor: isCorrect ? '#E8F8F0' : '#FDF2F2',
    color: isCorrect ? COLORS.green : COLORS.red,
    border: `2px solid ${isCorrect ? COLORS.green : COLORS.red}`,
  }),

  // Action row (retry + next)
  actionRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '16px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  // Error state
  errorContainer: {
    backgroundColor: COLORS.errorBg,
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center' as const,
    width: '100%',
  } as React.CSSProperties,

  errorIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  } as React.CSSProperties,

  errorTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.red,
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  errorMessage: {
    fontSize: '13px',
    color: COLORS.dark,
    lineHeight: 1.6,
    margin: '0 0 16px 0',
  } as React.CSSProperties,

  // Processing state
  processingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '24px',
  } as React.CSSProperties,

  processingText: {
    fontSize: '14px',
    color: COLORS.muted,
    fontWeight: 600,
  } as React.CSSProperties,

  spinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${COLORS.border}`,
    borderTop: `3px solid ${COLORS.primary}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: COLORS.red,
    animation: 'pulse 1s ease-in-out infinite',
  } as React.CSSProperties,

  recordingLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.red,
  } as React.CSSProperties,
} as const;

const KEYFRAME_CSS = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

// ============================================================
// Main Component
// ============================================================

export const PronunciationScreen: React.FC<PronunciationScreenProps> = ({
  word,
  fetchReferenceAudio,
  submitRecording,
  onNext,
}) => {
  // UI State
  const [uiState, setUIState] = useState<PronunciationUIState>('initial');
  const [error, setError] = useState<string | null>(null);

  // Audio playback
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Recording state
  const [elapsedMs, setElapsedMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);

  // Results
  const [result, setResult] = useState<PronunciationResult | null>(null);

  // === Fetch reference audio on mount ===
  useEffect(() => {
    let cancelled = false;

    const loadReferenceAudio = async () => {
      try {
        const response = await fetchReferenceAudio(word.id);
        if (!cancelled) {
          setReferenceAudioUrl(response.audioUrl);
        }
      } catch {
        // Non-critical — play button will handle absence gracefully
      }
    };

    loadReferenceAudio();
    return () => { cancelled = true; };
  }, [word.id, fetchReferenceAudio]);

  // === Cleanup on unmount ===
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // === Handlers ===

  const handlePlayReference = useCallback(() => {
    if (!referenceAudioUrl) return;

    if (referenceAudioRef.current) {
      referenceAudioRef.current.pause();
      referenceAudioRef.current.currentTime = 0;
    }

    const audio = new Audio(referenceAudioUrl);
    referenceAudioRef.current = audio;

    audio.onplay = () => setIsPlayingReference(true);
    audio.onended = () => setIsPlayingReference(false);
    audio.onerror = () => setIsPlayingReference(false);

    audio.play().catch(() => {
      setIsPlayingReference(false);
    });
  }, [referenceAudioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    recordedChunksRef.current = [];
    setElapsedMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        // Clear the timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });

        // Submit for scoring (Req 12.5)
        setUIState('processing');
        try {
          const scoringResult = await submitRecording(word.id, audioBlob);
          setResult(scoringResult);
          setUIState('results');
        } catch {
          setError('Failed to process recording. Please try again.');
          setUIState('initial');
        }
      };

      mediaRecorder.start();
      recordingStartRef.current = Date.now();
      setUIState('recording');

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartRef.current;
        setElapsedMs(elapsed);

        // Auto-stop at 10 seconds (Req 12.4)
        if (elapsed >= MAX_RECORDING_DURATION_MS) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 100);
    } catch (err: unknown) {
      // Microphone permission error handling (Req 12.11)
      const errorObj = err as { name?: string };
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        setError('microphone_permission_denied');
        setUIState('error');
      } else if (errorObj.name === 'NotFoundError') {
        setError('microphone_not_found');
        setUIState('error');
      } else {
        setError('Failed to access microphone. Please check your device settings.');
        setUIState('error');
      }
    }
  }, [word.id, submitRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setElapsedMs(0);
    setError(null);
    setUIState('initial');
  }, []);

  // === Render Helpers ===

  const renderWordDisplay = () => (
    <div aria-label={`Word: ${word.word}`}>
      <p style={styles.wordDisplay(word.language as SupportedLanguage)}>
        {word.word}
      </p>
      {word.phoneticTranscription && (
        <p style={styles.phoneticText} aria-label={`Phonetic: ${word.phoneticTranscription}`}>
          /{word.phoneticTranscription}/
        </p>
      )}
    </div>
  );

  const renderPlayButton = () => (
    <button
      type="button"
      style={styles.playButton}
      onClick={handlePlayReference}
      disabled={!referenceAudioUrl}
      aria-label="Play reference pronunciation"
    >
      <span role="img" aria-hidden="true">{isPlayingReference ? '⏸️' : '🔊'}</span>
      {isPlayingReference ? 'Playing...' : 'Listen'}
    </button>
  );

  const renderInitialState = () => (
    <>
      {renderWordDisplay()}
      {renderPlayButton()}
      <button
        type="button"
        style={styles.recordButton}
        onClick={startRecording}
        aria-label="Start recording your pronunciation"
      >
        🎤 Record
      </button>
    </>
  );

  const renderRecordingState = () => (
    <>
      {renderWordDisplay()}
      <div style={styles.recordingIndicator} role="status" aria-live="polite">
        <div style={styles.recordingDot} aria-hidden="true" />
        <span style={styles.recordingLabel}>Recording...</span>
      </div>
      <p style={styles.timerDisplay} aria-label={`Recording time: ${formatTimer(elapsedMs)}`}>
        {formatTimer(elapsedMs)}
      </p>
      <button
        type="button"
        style={styles.stopButton}
        onClick={stopRecording}
        aria-label="Stop recording"
      >
        ⏹️ Stop
      </button>
    </>
  );

  const renderProcessingState = () => (
    <div style={styles.processingContainer} role="status" aria-live="polite" aria-label="Processing your recording">
      {renderWordDisplay()}
      <div style={styles.spinner} aria-hidden="true" />
      <p style={styles.processingText}>Analyzing pronunciation...</p>
    </div>
  );

  const renderResultsState = () => {
    if (!result) return null;

    return (
      <>
        {renderWordDisplay()}

        {/* Accuracy score (Req 12.6) */}
        <div style={styles.accuracyContainer} aria-label={`Accuracy: ${result.accuracyScore} percent`}>
          <p style={styles.accuracyScore(result.accuracyScore)}>
            {result.accuracyScore}%
          </p>
          <p style={styles.accuracyLabel}>Accuracy</p>
        </div>

        {/* Syllable breakdown with color coding (Req 12.7) */}
        {result.syllableResults.length > 0 && (
          <div
            style={styles.syllableContainer}
            role="list"
            aria-label="Syllable results"
          >
            {result.syllableResults.map((sr: SyllableResult, idx: number) => (
              <span
                key={idx}
                style={styles.syllableChip(sr.isCorrect)}
                role="listitem"
                aria-label={`${sr.syllable}: ${sr.isCorrect ? 'correct' : 'incorrect'}`}
              >
                {sr.syllable}
              </span>
            ))}
          </div>
        )}

        {/* Retry + Next buttons (Req 12.8, 12.9) */}
        <div style={styles.actionRow}>
          <button
            type="button"
            style={styles.secondaryButton(false)}
            onClick={handleRetry}
            aria-label="Try again"
          >
            🔄 Retry
          </button>
          <button
            type="button"
            style={styles.primaryButton(false)}
            onClick={onNext}
            aria-label="Next word"
          >
            Next →
          </button>
        </div>
      </>
    );
  };

  const renderErrorState = () => {
    const isMicPermission = error === 'microphone_permission_denied';
    const isMicNotFound = error === 'microphone_not_found';

    return (
      <div style={styles.errorContainer} role="alert" aria-live="assertive">
        <p style={styles.errorIcon} aria-hidden="true">🎙️</p>
        <p style={styles.errorTitle}>
          {isMicPermission
            ? 'Microphone Permission Required'
            : isMicNotFound
              ? 'No Microphone Found'
              : 'Recording Error'}
        </p>
        <p style={styles.errorMessage}>
          {isMicPermission
            ? 'Please allow microphone access in your browser settings to record your pronunciation. Look for the camera/microphone icon in your browser\'s address bar and grant permission.'
            : isMicNotFound
              ? 'No microphone was detected on your device. Please connect a microphone and try again.'
              : error}
        </p>
        <button
          type="button"
          style={styles.primaryButton(false)}
          onClick={handleRetry}
          aria-label="Try again"
        >
          Try Again
        </button>
      </div>
    );
  };

  // === Main Render ===
  return (
    <>
      <style>{KEYFRAME_CSS}</style>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Pronunciation Practice</h1>

          {uiState === 'initial' && renderInitialState()}
          {uiState === 'recording' && renderRecordingState()}
          {uiState === 'processing' && renderProcessingState()}
          {uiState === 'results' && renderResultsState()}
          {uiState === 'error' && renderErrorState()}
        </div>
      </div>
    </>
  );
};

export default PronunciationScreen;
