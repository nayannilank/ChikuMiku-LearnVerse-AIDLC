/**
 * QuizScreen — Timed quiz assessment screen for ChikuMiku LearnVerse.
 *
 * Displays timed quiz questions with:
 * - Countdown timer (MM:SS, 30s–60min)
 * - Question counter "Q8/20"
 * - 4 answer options (A/B/C/D) as tappable cards
 * - Submit + Skip buttons
 * - Selected option → pink highlight; Submit without selection → inline prompt
 * - Web: live score panel (percentage + correct count)
 * - Timer reaches 0 or last question → final score summary
 * - Navigation away confirmation dialog
 *
 * Route: /exercises/quiz
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string]; // A, B, C, D
}

export interface QuizSessionData {
  id: string;
  questions: QuizQuestion[];
  timerDurationSeconds: number;
  totalQuestions: number;
}

export interface AnswerResponse {
  isCorrect: boolean;
  runningScore: number;
  answeredCount: number;
  correctCount: number;
}

export interface QuizResult {
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  timeTakenSeconds: number;
}

export interface QuizScreenProps {
  /** Create a new quiz session */
  createSession: () => Promise<QuizSessionData>;
  /** Submit an answer for the current question */
  submitAnswer: (sessionId: string, questionId: string, selectedOption: string) => Promise<AnswerResponse>;
  /** Skip the current question */
  skipQuestion: (sessionId: string, questionId: string) => Promise<void>;
  /** Get final result */
  getResult: (sessionId: string) => Promise<QuizResult>;
  /** Navigate away handler */
  onNavigateAway?: () => void;
  /** Called when quiz completes */
  onComplete?: (result: QuizResult) => void;
}

type SelectedOption = 'A' | 'B' | 'C' | 'D' | null;

type ScreenState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'active'; session: QuizSessionData; currentIndex: number }
  | { type: 'submitting'; session: QuizSessionData; currentIndex: number }
  | { type: 'final'; result: QuizResult };

// ============================================================
// Constants
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  primaryLight: '#E94F9B20',
  green: '#27AE60',
  greenBg: '#E8F8EF',
  red: '#E74C3C',
  redBg: '#FDF2F2',
  dark: '#2C2341',
  background: '#F8F5FF',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  gold: '#F7C948',
} as const;

const OPTION_LABELS: readonly string[] = ['A', 'B', 'C', 'D'];

// ============================================================
// Helper Functions
// ============================================================

/**
 * Format seconds into MM:SS string.
 * Requirement 14.1: Timer displayed in MM:SS format.
 */
export function formatTimer(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate score percentage from correct and total.
 */
export function calculateScorePercentage(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Get performance message based on percentage.
 */
function getPerformanceMessage(percentage: number): string {
  if (percentage === 100) return 'Perfect score! Outstanding performance!';
  if (percentage >= 80) return 'Excellent work! You have strong knowledge of this subject.';
  if (percentage >= 60) return 'Good job! Keep practicing to improve further.';
  if (percentage >= 40) return 'Not bad! Review the material and try again.';
  return 'Keep learning! Practice makes perfect.';
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
    maxWidth: '860px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  } as React.CSSProperties,

  timerBadge: (isLow: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '20px',
    backgroundColor: isLow ? COLORS.redBg : COLORS.white,
    border: `2px solid ${isLow ? COLORS.red : COLORS.border}`,
    fontSize: '16px',
    fontWeight: 700,
    color: isLow ? COLORS.red : COLORS.dark,
    animation: isLow ? 'pulse 1s ease-in-out infinite' : 'none',
  }),

  questionCounter: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.muted,
  } as React.CSSProperties,

  mainLayout: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
  } as React.CSSProperties,

  questionArea: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '20px',
  } as React.CSSProperties,

  questionText: {
    fontSize: '16px',
    fontWeight: 500,
    color: COLORS.dark,
    lineHeight: 1.7,
    marginBottom: '24px',
    margin: 0,
  } as React.CSSProperties,

  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '24px',
  } as React.CSSProperties,

  optionCard: (isSelected: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 18px',
    border: `2px solid ${isSelected ? COLORS.primary : COLORS.border}`,
    borderRadius: '16px',
    backgroundColor: isSelected ? COLORS.primaryLight : COLORS.white,
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: isSelected ? `0 0 0 1px ${COLORS.primary}` : '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'all 0.15s ease',
    textAlign: 'left' as const,
  }),

  optionLabel: (isSelected: boolean): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSelected ? COLORS.primary : COLORS.background,
    color: isSelected ? COLORS.white : COLORS.dark,
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  }),

  optionText: {
    fontSize: '13px',
    color: COLORS.dark,
    fontWeight: 400,
    lineHeight: 1.4,
  } as React.CSSProperties,

  buttonsRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  } as React.CSSProperties,

  submitButton: (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '14px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.primary,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background-color 0.15s',
  }),

  skipButton: {
    padding: '14px 24px',
    borderRadius: '22px',
    border: `2px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  inlinePrompt: {
    fontSize: '12px',
    color: COLORS.red,
    fontWeight: 500,
    marginTop: '8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  // Live score panel (web)
  scorePanel: {
    width: '200px',
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    textAlign: 'center' as const,
    position: 'sticky' as const,
    top: '24px',
  } as React.CSSProperties,

  scorePanelTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px',
  } as React.CSSProperties,

  scorePanelPercentage: {
    fontSize: '36px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '4px',
  } as React.CSSProperties,

  scorePanelCount: {
    fontSize: '13px',
    color: COLORS.muted,
    fontWeight: 500,
  } as React.CSSProperties,

  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
  } as React.CSSProperties,

  loadingText: {
    fontSize: '14px',
    color: COLORS.muted,
  } as React.CSSProperties,

  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  // Error
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  errorText: {
    fontSize: '14px',
    color: COLORS.red,
    maxWidth: '300px',
  } as React.CSSProperties,

  retryButton: {
    padding: '12px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Final summary
  summaryContainer: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '40px 24px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    maxWidth: '480px',
    margin: '0 auto',
  } as React.CSSProperties,

  summaryIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  } as React.CSSProperties,

  summaryTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '8px',
  } as React.CSSProperties,

  summaryScore: (percentage: number): React.CSSProperties => ({
    fontSize: '48px',
    fontWeight: 700,
    color: percentage >= 80 ? COLORS.green : percentage >= 50 ? COLORS.gold : COLORS.red,
    margin: '16px 0',
  }),

  summaryStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginBottom: '16px',
  } as React.CSSProperties,

  summaryStat: {
    textAlign: 'center' as const,
  } as React.CSSProperties,

  summaryStatValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: COLORS.dark,
  } as React.CSSProperties,

  summaryStatLabel: {
    fontSize: '11px',
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  summaryMessage: {
    fontSize: '14px',
    color: COLORS.muted,
    marginBottom: '24px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  summaryDoneButton: {
    padding: '14px 32px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Confirmation dialog
  dialogOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,

  dialogCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '28px',
    maxWidth: '380px',
    width: '90%',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  dialogTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '8px',
  } as React.CSSProperties,

  dialogMessage: {
    fontSize: '13px',
    color: COLORS.muted,
    marginBottom: '20px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  dialogButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  } as React.CSSProperties,

  dialogCancelButton: {
    padding: '10px 20px',
    borderRadius: '22px',
    border: `2px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  dialogConfirmButton: {
    padding: '10px 20px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.red,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Result indicator
  resultIndicator: (isCorrect: boolean): React.CSSProperties => ({
    marginTop: '12px',
    padding: '10px 16px',
    borderRadius: '10px',
    backgroundColor: isCorrect ? COLORS.greenBg : COLORS.redBg,
    borderLeft: `4px solid ${isCorrect ? COLORS.green : COLORS.red}`,
    fontSize: '13px',
    fontWeight: 600,
    color: isCorrect ? COLORS.green : COLORS.red,
  }),
} as const;

// ============================================================
// CSS Animations
// ============================================================

const ANIMATIONS_CSS = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

// ============================================================
// Sub-Components
// ============================================================

/** Loading state view */
const LoadingView: React.FC = () => (
  <div style={styles.loadingContainer} role="status" aria-label="Creating quiz session">
    <div style={styles.loadingSpinner} />
    <p style={styles.loadingText}>Creating quiz session...</p>
  </div>
);

/** Error state view */
const ErrorView: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={styles.errorContainer} role="alert" aria-live="assertive">
    <div style={{ fontSize: '40px' }} aria-hidden="true">⚠️</div>
    <p style={styles.errorText}>{message}</p>
    <button style={styles.retryButton} onClick={onRetry} aria-label="Retry creating session">
      Try Again
    </button>
  </div>
);

/** Final score summary (Req 14.8) */
const FinalSummaryView: React.FC<{
  result: QuizResult;
  onDone?: () => void;
}> = ({ result, onDone }) => {
  const icon = result.scorePercentage >= 80 ? '🏆' : result.scorePercentage >= 50 ? '👏' : '📚';
  const timeMins = Math.floor(result.timeTakenSeconds / 60);
  const timeSecs = result.timeTakenSeconds % 60;
  const timeStr = timeMins > 0 ? `${timeMins}m ${timeSecs}s` : `${timeSecs}s`;

  return (
    <div style={styles.summaryContainer} role="region" aria-label="Quiz completion summary">
      <div style={styles.summaryIcon} aria-hidden="true">{icon}</div>
      <h2 style={styles.summaryTitle}>Quiz Complete!</h2>
      <div
        style={styles.summaryScore(result.scorePercentage)}
        aria-label={`Score: ${result.scorePercentage} percent`}
      >
        {result.scorePercentage}%
      </div>
      <div style={styles.summaryStats}>
        <div style={styles.summaryStat}>
          <div style={styles.summaryStatValue}>{result.correctAnswers}/{result.totalQuestions}</div>
          <div style={styles.summaryStatLabel}>Correct</div>
        </div>
        <div style={styles.summaryStat}>
          <div style={styles.summaryStatValue}>{timeStr}</div>
          <div style={styles.summaryStatLabel}>Time Taken</div>
        </div>
      </div>
      <p style={styles.summaryMessage}>{getPerformanceMessage(result.scorePercentage)}</p>
      {onDone && (
        <button style={styles.summaryDoneButton} onClick={onDone} aria-label="Done">
          Done
        </button>
      )}
    </div>
  );
};

/** Navigation confirmation dialog (Req 14.9) */
const ConfirmationDialog: React.FC<{
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
  <div
    style={styles.dialogOverlay}
    role="dialog"
    aria-modal="true"
    aria-label="Leave quiz confirmation"
  >
    <div style={styles.dialogCard}>
      <h3 style={styles.dialogTitle}>Leave Quiz?</h3>
      <p style={styles.dialogMessage}>
        Are you sure you want to leave? Your progress will be lost and the quiz session will not be saved.
      </p>
      <div style={styles.dialogButtons}>
        <button style={styles.dialogCancelButton} onClick={onCancel} aria-label="Stay in quiz">
          Stay
        </button>
        <button style={styles.dialogConfirmButton} onClick={onConfirm} aria-label="Confirm leave quiz">
          Leave Quiz
        </button>
      </div>
    </div>
  </div>
);

/** Live score panel for web (Req 14.7) */
const LiveScorePanel: React.FC<{
  percentage: number;
  correctCount: number;
  answeredCount: number;
}> = ({ percentage, correctCount, answeredCount }) => (
  <aside style={styles.scorePanel} role="complementary" aria-label="Live score panel">
    <div style={styles.scorePanelTitle}>Live Score</div>
    <div style={styles.scorePanelPercentage} aria-label={`${percentage} percent`}>
      {percentage}%
    </div>
    <div style={styles.scorePanelCount}>
      {correctCount} correct / {answeredCount} answered
    </div>
  </aside>
);

// ============================================================
// Main Component
// ============================================================

export const QuizScreen: React.FC<QuizScreenProps> = ({
  createSession,
  submitAnswer,
  skipQuestion,
  getResult,
  onNavigateAway,
  onComplete,
}) => {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'loading' });
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);
  const [showNoSelectionPrompt, setShowNoSelectionPrompt] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [lastAnswerResult, setLastAnswerResult] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // End the quiz and show final result
  const endQuiz = useCallback(async (sessionId: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      const result = await getResult(sessionId);
      setScreenState({ type: 'final', result });
      onComplete?.(result);
    } catch {
      // Fallback: compute from local state
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const totalQ = screenState.type === 'active' || screenState.type === 'submitting'
        ? screenState.session.totalQuestions
        : 0;
      const fallbackResult: QuizResult = {
        totalQuestions: totalQ,
        correctAnswers: correctCount,
        scorePercentage: calculateScorePercentage(correctCount, totalQ),
        timeTakenSeconds: elapsed,
      };
      setScreenState({ type: 'final', result: fallbackResult });
      onComplete?.(fallbackResult);
    }
  }, [getResult, onComplete, screenState, correctCount]);

  // Start timer countdown (Req 14.1)
  const startTimer = useCallback((durationSeconds: number, sessionId: string) => {
    setTimeRemaining(durationSeconds);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer reached 0 → end quiz (Req 14.8)
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          endQuiz(sessionId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [endQuiz]);

  // Initialize quiz session
  const initSession = useCallback(async () => {
    setScreenState({ type: 'loading' });
    try {
      const session = await createSession();
      if (session.questions.length === 0) {
        setScreenState({ type: 'error', message: 'No questions available for this quiz.' });
        return;
      }
      setScreenState({ type: 'active', session, currentIndex: 0 });
      setCorrectCount(0);
      setAnsweredCount(0);
      setSelectedOption(null);
      setShowNoSelectionPrompt(false);
      setLastAnswerResult(null);
      startTimer(session.timerDurationSeconds, session.id);
    } catch {
      setScreenState({ type: 'error', message: 'Unable to create quiz session. Please try again.' });
    }
  }, [createSession, startTimer]);

  useEffect(() => {
    initSession();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance to next question or end quiz
  const advanceQuestion = useCallback((session: QuizSessionData, currentIndex: number) => {
    const isLast = currentIndex >= session.questions.length - 1;
    if (isLast) {
      endQuiz(session.id);
    } else {
      setScreenState({ type: 'active', session, currentIndex: currentIndex + 1 });
      setSelectedOption(null);
      setShowNoSelectionPrompt(false);
      setLastAnswerResult(null);
    }
  }, [endQuiz]);

  // Handle option selection (Req 14.4)
  const handleOptionSelect = useCallback((option: SelectedOption) => {
    if (screenState.type !== 'active') return;
    setSelectedOption(option);
    setShowNoSelectionPrompt(false);
  }, [screenState.type]);

  // Handle submit (Req 14.5, 14.10)
  const handleSubmit = useCallback(async () => {
    if (screenState.type !== 'active') return;

    // Req 14.10: Submit without selection → inline prompt
    if (selectedOption === null) {
      setShowNoSelectionPrompt(true);
      return;
    }

    const { session, currentIndex } = screenState;
    const currentQuestion = session.questions[currentIndex];

    setScreenState({ type: 'submitting', session, currentIndex });

    try {
      const response = await submitAnswer(session.id, currentQuestion.id, selectedOption);
      setCorrectCount(response.correctCount);
      setAnsweredCount(response.answeredCount);
      setLastAnswerResult(response.isCorrect);

      // Brief delay to show result indicator, then advance
      setTimeout(() => {
        advanceQuestion(session, currentIndex);
      }, 800);
    } catch {
      // On failure, still advance to avoid getting stuck
      setScreenState({ type: 'active', session, currentIndex });
    }
  }, [screenState, selectedOption, submitAnswer, advanceQuestion]);

  // Handle skip (Req 14.6)
  const handleSkip = useCallback(async () => {
    if (screenState.type !== 'active') return;

    const { session, currentIndex } = screenState;
    const currentQuestion = session.questions[currentIndex];

    try {
      await skipQuestion(session.id, currentQuestion.id);
    } catch {
      // Continue even if skip API fails
    }
    advanceQuestion(session, currentIndex);
  }, [screenState, skipQuestion, advanceQuestion]);

  // Handle navigation away (Req 14.9)
  const handleNavigateAway = useCallback(() => {
    if (screenState.type === 'active' || screenState.type === 'submitting') {
      setShowConfirmDialog(true);
    } else {
      onNavigateAway?.();
    }
  }, [screenState.type, onNavigateAway]);

  const confirmLeave = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setShowConfirmDialog(false);
    onNavigateAway?.();
  }, [onNavigateAway]);

  const cancelLeave = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // ============================================================
  // Render
  // ============================================================

  // Loading state
  if (screenState.type === 'loading') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}><LoadingView /></div>
      </>
    );
  }

  // Error state
  if (screenState.type === 'error') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <ErrorView message={screenState.message} onRetry={initSession} />
        </div>
      </>
    );
  }

  // Final summary (Req 14.8)
  if (screenState.type === 'final') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <FinalSummaryView result={screenState.result} onDone={onNavigateAway} />
        </div>
      </>
    );
  }

  // Active / Submitting state
  const { session, currentIndex } = screenState;
  const currentQuestion = session.questions[currentIndex];
  const totalQuestions = session.totalQuestions;
  const isSubmitting = screenState.type === 'submitting';
  const isTimeLow = timeRemaining <= 30;
  const scorePercentage = answeredCount > 0 ? calculateScorePercentage(correctCount, answeredCount) : 0;

  return (
    <>
      <style>{ANIMATIONS_CSS}</style>
      <div style={styles.container} data-testid="quiz-screen">
        {/* Header: Timer + Question Counter (Req 14.1, 14.2) */}
        <header style={styles.header}>
          <div
            style={styles.timerBadge(isTimeLow)}
            role="timer"
            aria-label={`Time remaining: ${formatTimer(timeRemaining)}`}
          >
            ⏱ {formatTimer(timeRemaining)}
          </div>
          <span style={styles.questionCounter} aria-label={`Question ${currentIndex + 1} of ${totalQuestions}`}>
            Q{currentIndex + 1}/{totalQuestions}
          </span>
          {onNavigateAway && (
            <button style={styles.skipButton} onClick={handleNavigateAway} aria-label="Leave quiz">
              ✕ Leave
            </button>
          )}
        </header>

        {/* Main layout: Question + Score Panel */}
        <div style={styles.mainLayout}>
          {/* Question area */}
          <div style={styles.questionArea}>
            <div style={styles.questionCard}>
              {/* Question text (Req 14.3) */}
              <p style={styles.questionText}>{currentQuestion.questionText}</p>

              {/* 4 option cards A/B/C/D (Req 14.3, 14.4) */}
              <div style={styles.optionsGrid} role="radiogroup" aria-label="Answer options">
                {currentQuestion.options.map((option, idx) => {
                  const label = OPTION_LABELS[idx] as 'A' | 'B' | 'C' | 'D';
                  const isSelected = selectedOption === label;
                  return (
                    <button
                      key={idx}
                      style={styles.optionCard(isSelected, isSubmitting)}
                      onClick={() => handleOptionSelect(label)}
                      disabled={isSubmitting}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Option ${label}: ${option}`}
                    >
                      <span style={styles.optionLabel(isSelected)}>{label}</span>
                      <span style={styles.optionText}>{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Result indicator after submit */}
              {lastAnswerResult !== null && isSubmitting && (
                <div style={styles.resultIndicator(lastAnswerResult)} role="status">
                  {lastAnswerResult ? '✓ Correct!' : '✗ Incorrect'}
                </div>
              )}
            </div>

            {/* Submit + Skip buttons (Req 14.5, 14.6) */}
            <div style={styles.buttonsRow}>
              <button
                style={styles.submitButton(isSubmitting)}
                onClick={handleSubmit}
                disabled={isSubmitting}
                aria-label="Submit answer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                style={styles.skipButton}
                onClick={handleSkip}
                disabled={isSubmitting}
                aria-label="Skip question"
              >
                Skip →
              </button>
            </div>

            {/* Inline prompt: no selection (Req 14.10) */}
            {showNoSelectionPrompt && (
              <p style={styles.inlinePrompt} role="alert" aria-live="polite">
                Please select an answer before submitting.
              </p>
            )}
          </div>

          {/* Live Score Panel — Web (Req 14.7) */}
          <LiveScorePanel
            percentage={scorePercentage}
            correctCount={correctCount}
            answeredCount={answeredCount}
          />
        </div>

        {/* Confirmation Dialog (Req 14.9) */}
        {showConfirmDialog && (
          <ConfirmationDialog onConfirm={confirmLeave} onCancel={cancelLeave} />
        )}
      </div>
    </>
  );
};

export default QuizScreen;
