/**
 * MathsPracticeScreen — Maths practice with visual fraction aids for ChikuMiku LearnVerse.
 *
 * Displays fraction problems with:
 * - Visual fraction representation (circles/rectangles with colored portions)
 * - Numerator + denominator input fields (integers 0-99)
 * - "Check Answer" button with validation
 * - Empty/non-integer → inline validation message
 * - Correct → green success indicator
 * - Incorrect → red indicator + hint (which part is wrong)
 * - Question counter "3/10" (5-20 questions per set)
 *
 * Route: /exercises/maths
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */

import React, { useCallback, useEffect, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface FractionQuestion {
  id: string;
  /** Numerator of the fraction to represent visually */
  numerator: number;
  /** Denominator of the fraction to represent visually */
  denominator: number;
  /** Shape type for the visual representation */
  shapeType: 'circle' | 'rectangle';
  /** Sequence number (1-based) */
  sequenceNumber: number;
}

export interface MathsAnswerResponse {
  isCorrect: boolean;
  hint?: {
    wrongPart: 'numerator' | 'denominator' | 'both';
  };
}

export interface MathsExerciseSet {
  id: string;
  subjectId: string;
  questions: FractionQuestion[];
}

export interface MathsPracticeScreenProps {
  /** Fetch the exercise set */
  fetchExercises: () => Promise<MathsExerciseSet>;
  /** Check the student's answer */
  checkAnswer: (
    exerciseId: string,
    questionId: string,
    numerator: number,
    denominator: number
  ) => Promise<MathsAnswerResponse>;
  /** Navigate back/away */
  onBack?: () => void;
  /** Called when exercise set completes */
  onComplete?: (score: { correct: number; total: number }) => void;
}

export interface MathsInputValidationResult {
  valid: boolean;
  error?: string;
}

type ScreenState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'active'; exerciseSet: MathsExerciseSet; currentIndex: number }
  | { type: 'checking'; exerciseSet: MathsExerciseSet; currentIndex: number }
  | { type: 'complete'; correct: number; total: number };

type FeedbackState =
  | null
  | { type: 'correct' }
  | { type: 'incorrect'; hint: string };

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

// ============================================================
// Exported Helper — validateMathsInput
// ============================================================

/**
 * Validates a maths input value for the numerator or denominator field.
 * Accepts integers between 0 and 99 inclusive.
 * Rejects empty strings, non-integer values, and out-of-range values.
 *
 * Exported for use in property-based tests.
 *
 * Validates: Requirements 15.2, 15.4
 */
export function validateMathsInput(value: string): MathsInputValidationResult {
  if (value.trim() === '') {
    return { valid: false, error: 'Please enter a whole number' };
  }

  // Must be a string of digits only (with optional leading sign check)
  // We reject anything that isn't purely digits (no decimals, no letters, no special chars)
  if (!/^\d+$/.test(value.trim())) {
    return { valid: false, error: 'Please enter a whole number (0-99)' };
  }

  const parsed = parseInt(value.trim(), 10);

  if (parsed < 0 || parsed > 99) {
    return { valid: false, error: 'Value must be between 0 and 99' };
  }

  return { valid: true };
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
    maxWidth: '720px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  } as React.CSSProperties,

  counter: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
  } as React.CSSProperties,

  backButton: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: `2px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '20px',
  } as React.CSSProperties,

  visualContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '20px',
  } as React.CSSProperties,

  fractionLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.muted,
    textAlign: 'center' as const,
    marginBottom: '16px',
  } as React.CSSProperties,

  inputRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px',
  } as React.CSSProperties,

  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,

  inputLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  inputField: (hasError: boolean): React.CSSProperties => ({
    width: '72px',
    padding: '12px 16px',
    fontSize: '18px',
    fontWeight: 600,
    textAlign: 'center' as const,
    border: `2px solid ${hasError ? COLORS.red : COLORS.border}`,
    borderRadius: '8px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    outline: 'none',
  }),

  fractionDivider: {
    fontSize: '24px',
    fontWeight: 700,
    color: COLORS.dark,
    padding: '0 4px',
  } as React.CSSProperties,

  validationMessage: {
    fontSize: '12px',
    color: COLORS.red,
    fontWeight: 500,
    textAlign: 'center' as const,
    marginTop: '8px',
  } as React.CSSProperties,

  checkButton: (disabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.primary,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    marginTop: '20px',
    transition: 'background-color 0.15s',
  }),

  nextButton: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '12px',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  feedbackPanel: (isCorrect: boolean): React.CSSProperties => ({
    marginTop: '16px',
    padding: '16px 18px',
    backgroundColor: isCorrect ? COLORS.greenBg : COLORS.redBg,
    borderRadius: '10px',
    borderLeft: `4px solid ${isCorrect ? COLORS.green : COLORS.red}`,
  }),

  feedbackTitle: (isCorrect: boolean): React.CSSProperties => ({
    fontSize: '13px',
    fontWeight: 700,
    color: isCorrect ? COLORS.green : COLORS.red,
    marginBottom: '4px',
  }),

  feedbackText: {
    fontSize: '13px',
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: 0,
  } as React.CSSProperties,

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

  summaryContainer: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '40px 24px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
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

  summaryScore: (correct: number, total: number): React.CSSProperties => ({
    fontSize: '48px',
    fontWeight: 700,
    color: correct === total ? COLORS.green : correct >= total / 2 ? COLORS.gold : COLORS.red,
    margin: '16px 0',
  }),

  summaryMessage: {
    fontSize: '14px',
    color: COLORS.muted,
    marginBottom: '24px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  summaryBackButton: {
    padding: '14px 32px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
} as const;

// ============================================================
// CSS Animations
// ============================================================

const ANIMATIONS_CSS = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ============================================================
// Visual Fraction Components (Req 15.1)
// ============================================================

/**
 * Renders a circle divided into `denominator` equal slices,
 * with `numerator` slices filled with the primary color.
 */
const CircleFraction: React.FC<{
  numerator: number;
  denominator: number;
}> = ({ numerator, denominator }) => {
  const size = 160;
  const center = size / 2;
  const radius = 60;

  if (denominator === 0) {
    return (
      <svg width={size} height={size} role="img" aria-label="Fraction visual: undefined">
        <circle cx={center} cy={center} r={radius} fill={COLORS.border} stroke={COLORS.dark} strokeWidth="2" />
      </svg>
    );
  }

  const slices: React.ReactNode[] = [];
  const sliceAngle = (2 * Math.PI) / denominator;

  for (let i = 0; i < denominator; i++) {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = (i + 1) * sliceAngle - Math.PI / 2;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    const isFilled = i < numerator;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    slices.push(
      <path
        key={i}
        d={pathData}
        fill={isFilled ? COLORS.primary : COLORS.border}
        stroke={COLORS.dark}
        strokeWidth="1.5"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={`Circle showing ${numerator} out of ${denominator} parts colored`}
    >
      {slices}
    </svg>
  );
};

/**
 * Renders a rectangle divided into `denominator` equal parts,
 * with `numerator` parts filled with the primary color.
 */
const RectangleFraction: React.FC<{
  numerator: number;
  denominator: number;
}> = ({ numerator, denominator }) => {
  const width = 200;
  const height = 60;

  if (denominator === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label="Fraction visual: undefined">
        <rect x="0" y="0" width={width} height={height} fill={COLORS.border} stroke={COLORS.dark} strokeWidth="2" rx="4" />
      </svg>
    );
  }

  const partWidth = width / denominator;
  const parts: React.ReactNode[] = [];

  for (let i = 0; i < denominator; i++) {
    const isFilled = i < numerator;
    parts.push(
      <rect
        key={i}
        x={i * partWidth}
        y="0"
        width={partWidth}
        height={height}
        fill={isFilled ? COLORS.primary : COLORS.border}
        stroke={COLORS.dark}
        strokeWidth="1.5"
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Rectangle showing ${numerator} out of ${denominator} parts colored`}
    >
      {parts}
    </svg>
  );
};

// ============================================================
// Sub-Components
// ============================================================

/** Loading state view */
const LoadingView: React.FC = () => (
  <div style={styles.loadingContainer} role="status" aria-label="Loading exercises">
    <div style={styles.loadingSpinner} />
    <p style={styles.loadingText}>Loading maths exercises...</p>
  </div>
);

/** Error state view */
const ErrorView: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={styles.errorContainer} role="alert" aria-live="assertive">
    <div style={{ fontSize: '40px' }} aria-hidden="true">⚠️</div>
    <p style={styles.errorText}>{message}</p>
    <button style={styles.retryButton} onClick={onRetry} aria-label="Retry loading exercises">
      Try Again
    </button>
  </div>
);

/** Completion summary view */
const CompletionView: React.FC<{
  correct: number;
  total: number;
  onBack?: () => void;
}> = ({ correct, total, onBack }) => {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const icon = correct === total ? '🏆' : correct >= total / 2 ? '👏' : '📚';

  return (
    <div style={styles.summaryContainer} role="region" aria-label="Exercise completion summary">
      <div style={styles.summaryIcon} aria-hidden="true">{icon}</div>
      <h2 style={styles.summaryTitle}>Maths Practice Complete!</h2>
      <div
        style={styles.summaryScore(correct, total)}
        aria-label={`Score: ${correct} out of ${total} correct`}
      >
        {correct}/{total}
      </div>
      <p style={styles.summaryMessage}>
        You scored {percentage}% on this exercise set.
      </p>
      {onBack && (
        <button style={styles.summaryBackButton} onClick={onBack} aria-label="Return to exercises">
          Done
        </button>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const MathsPracticeScreen: React.FC<MathsPracticeScreenProps> = ({
  fetchExercises,
  checkAnswer,
  onBack,
  onComplete,
}) => {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'loading' });
  const [numeratorInput, setNumeratorInput] = useState('');
  const [denominatorInput, setDenominatorInput] = useState('');
  const [numeratorError, setNumeratorError] = useState('');
  const [denominatorError, setDenominatorError] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [correctCount, setCorrectCount] = useState(0);

  // Load exercise data
  const loadExercises = useCallback(async () => {
    setScreenState({ type: 'loading' });
    try {
      const exerciseSet = await fetchExercises();
      if (exerciseSet.questions.length === 0) {
        setScreenState({
          type: 'error',
          message: 'No maths exercises available.',
        });
        return;
      }
      setScreenState({ type: 'active', exerciseSet, currentIndex: 0 });
      setCorrectCount(0);
      resetInputs();
    } catch {
      setScreenState({
        type: 'error',
        message: 'Unable to load maths exercises. Please check your connection and try again.',
      });
    }
  }, [fetchExercises]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const resetInputs = () => {
    setNumeratorInput('');
    setDenominatorInput('');
    setNumeratorError('');
    setDenominatorError('');
    setFeedback(null);
  };

  // Handle Check Answer (Req 15.3, 15.4, 15.5, 15.6)
  const handleCheckAnswer = useCallback(async () => {
    if (screenState.type !== 'active') return;

    // Validate inputs (Req 15.4)
    const numValidation = validateMathsInput(numeratorInput);
    const denValidation = validateMathsInput(denominatorInput);

    setNumeratorError(numValidation.error || '');
    setDenominatorError(denValidation.error || '');

    if (!numValidation.valid || !denValidation.valid) {
      return;
    }

    const { exerciseSet, currentIndex } = screenState;
    const currentQuestion = exerciseSet.questions[currentIndex];
    const numVal = parseInt(numeratorInput.trim(), 10);
    const denVal = parseInt(denominatorInput.trim(), 10);

    setScreenState({ type: 'checking', exerciseSet, currentIndex });

    try {
      const response = await checkAnswer(
        exerciseSet.id,
        currentQuestion.id,
        numVal,
        denVal
      );

      if (response.isCorrect) {
        setFeedback({ type: 'correct' });
        setCorrectCount((prev) => prev + 1);
      } else {
        const hintText = getHintText(response.hint?.wrongPart || 'both');
        setFeedback({ type: 'incorrect', hint: hintText });
      }

      setScreenState({ type: 'active', exerciseSet, currentIndex });
    } catch {
      setFeedback({ type: 'incorrect', hint: 'Unable to check answer. Please try again.' });
      setScreenState({ type: 'active', exerciseSet, currentIndex });
    }
  }, [screenState, numeratorInput, denominatorInput, checkAnswer]);

  // Handle Next question
  const handleNext = useCallback(() => {
    if (screenState.type !== 'active') return;

    const { exerciseSet, currentIndex } = screenState;
    const isLast = currentIndex >= exerciseSet.questions.length - 1;

    if (isLast) {
      const total = exerciseSet.questions.length;
      setScreenState({ type: 'complete', correct: correctCount, total });
      onComplete?.({ correct: correctCount, total });
    } else {
      setScreenState({ type: 'active', exerciseSet, currentIndex: currentIndex + 1 });
      resetInputs();
    }
  }, [screenState, correctCount, onComplete]);

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
          <ErrorView message={screenState.message} onRetry={loadExercises} />
        </div>
      </>
    );
  }

  // Completion state
  if (screenState.type === 'complete') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <CompletionView correct={screenState.correct} total={screenState.total} onBack={onBack} />
        </div>
      </>
    );
  }

  // Active / Checking state
  const { exerciseSet, currentIndex } = screenState;
  const currentQuestion = exerciseSet.questions[currentIndex];
  const totalQuestions = exerciseSet.questions.length;
  const isChecking = screenState.type === 'checking';

  return (
    <>
      <style>{ANIMATIONS_CSS}</style>
      <div style={styles.container} data-testid="maths-practice-screen">
        {/* Header: Question counter (Req 15.7) */}
        <header style={styles.header}>
          <span
            style={styles.counter}
            aria-label={`Question ${currentIndex + 1} of ${totalQuestions}`}
          >
            {currentIndex + 1}/{totalQuestions}
          </span>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} aria-label="Back">
              ← Back
            </button>
          )}
        </header>

        {/* Question Card */}
        <div style={styles.questionCard}>
          {/* Visual fraction representation (Req 15.1) */}
          <p style={styles.fractionLabel}>What fraction is shown?</p>
          <div style={styles.visualContainer}>
            {currentQuestion.shapeType === 'circle' ? (
              <CircleFraction
                numerator={currentQuestion.numerator}
                denominator={currentQuestion.denominator}
              />
            ) : (
              <RectangleFraction
                numerator={currentQuestion.numerator}
                denominator={currentQuestion.denominator}
              />
            )}
          </div>

          {/* Numerator + Denominator inputs (Req 15.2) */}
          <div style={styles.inputRow}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel} htmlFor="numerator-input">
                Numerator
              </label>
              <input
                id="numerator-input"
                type="text"
                inputMode="numeric"
                style={styles.inputField(!!numeratorError)}
                value={numeratorInput}
                onChange={(e) => {
                  setNumeratorInput(e.target.value);
                  if (numeratorError) setNumeratorError('');
                  if (feedback) setFeedback(null);
                }}
                placeholder="?"
                disabled={isChecking}
                aria-label="Numerator"
                aria-invalid={!!numeratorError}
                aria-describedby={numeratorError ? 'numerator-error' : undefined}
              />
            </div>
            <span style={styles.fractionDivider} aria-hidden="true">/</span>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel} htmlFor="denominator-input">
                Denominator
              </label>
              <input
                id="denominator-input"
                type="text"
                inputMode="numeric"
                style={styles.inputField(!!denominatorError)}
                value={denominatorInput}
                onChange={(e) => {
                  setDenominatorInput(e.target.value);
                  if (denominatorError) setDenominatorError('');
                  if (feedback) setFeedback(null);
                }}
                placeholder="?"
                disabled={isChecking}
                aria-label="Denominator"
                aria-invalid={!!denominatorError}
                aria-describedby={denominatorError ? 'denominator-error' : undefined}
              />
            </div>
          </div>

          {/* Validation messages (Req 15.4) */}
          {numeratorError && (
            <p id="numerator-error" style={styles.validationMessage} role="alert" aria-live="polite">
              Numerator: {numeratorError}
            </p>
          )}
          {denominatorError && (
            <p id="denominator-error" style={styles.validationMessage} role="alert" aria-live="polite">
              Denominator: {denominatorError}
            </p>
          )}

          {/* Feedback panel (Req 15.5, 15.6) */}
          {feedback && (
            <div
              style={styles.feedbackPanel(feedback.type === 'correct')}
              role="alert"
              aria-live="polite"
              aria-label={feedback.type === 'correct' ? 'Correct answer' : 'Incorrect answer'}
            >
              <div style={styles.feedbackTitle(feedback.type === 'correct')}>
                {feedback.type === 'correct' ? '✓ Correct!' : '✗ Incorrect'}
              </div>
              {feedback.type === 'correct' ? (
                <p style={styles.feedbackText}>Great job! Your answer is correct.</p>
              ) : (
                <p style={styles.feedbackText}>{feedback.hint}</p>
              )}
            </div>
          )}
        </div>

        {/* Check Answer / Next buttons */}
        {!feedback ? (
          <button
            style={styles.checkButton(isChecking)}
            onClick={handleCheckAnswer}
            disabled={isChecking}
            aria-label="Check answer"
          >
            {isChecking ? 'Checking...' : 'Check Answer'}
          </button>
        ) : (
          <button
            style={styles.nextButton}
            onClick={handleNext}
            aria-label={currentIndex >= totalQuestions - 1 ? 'Finish and see results' : 'Next question'}
          >
            {currentIndex >= totalQuestions - 1 ? 'See Results' : 'Next →'}
          </button>
        )}
      </div>
    </>
  );
};

// ============================================================
// Helper
// ============================================================

/**
 * Generate a human-readable hint about which part of the fraction is wrong.
 * Requirement 15.6: hint identifies whether numerator or denominator (or both) is wrong.
 */
function getHintText(wrongPart: 'numerator' | 'denominator' | 'both'): string {
  switch (wrongPart) {
    case 'numerator':
      return 'Hint: Check your numerator — the denominator looks correct.';
    case 'denominator':
      return 'Hint: Check your denominator — the numerator looks correct.';
    case 'both':
      return 'Hint: Both the numerator and denominator need another look.';
  }
}

export default MathsPracticeScreen;
