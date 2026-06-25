/**
 * GrammarExerciseScreen — Grammar fill-in-the-blank exercise screen for ChikuMiku LearnVerse.
 *
 * Displays grammar exercises one at a time with:
 * - Question counter "N/T" (T between 1-30)
 * - Progress bar (N/T × 100%)
 * - Sentence with underscore placeholder
 * - 2-5 multiple-choice options
 * - Pink highlight on selection + feedback panel (green correct / red incorrect)
 * - Next button disabled until answered
 * - Completion summary on last question
 *
 * Route: /exercises/grammar
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface GrammarQuestion {
  id: string;
  /** Sentence with a blank indicated by "___" or similar placeholder */
  sentence: string;
  /** 2-5 multiple-choice options */
  options: string[];
  /** Sequence number (1-based) */
  sequenceNumber: number;
}

export interface GrammarValidationResponse {
  isCorrect: boolean;
  correctAnswer: string;
  feedback: string;
  grammarRule: string;
}

export interface GrammarExerciseSet {
  id: string;
  subjectId: string;
  chapterId?: string;
  questions: GrammarQuestion[];
}

export interface GrammarExerciseScreenProps {
  /** Fetch exercise set for the subject/chapter */
  fetchExercises: () => Promise<GrammarExerciseSet>;
  /** Validate a selected answer against the backend */
  validateAnswer: (exerciseId: string, questionId: string, selectedOption: string) => Promise<GrammarValidationResponse>;
  /** Navigate back/away from the exercise */
  onBack?: () => void;
  /** Called when the exercise set is completed */
  onComplete?: (score: { correct: number; total: number }) => void;
}

interface QuestionState {
  selectedOption: number | null;
  validation: GrammarValidationResponse | null;
  validationLoading: boolean;
}

type ScreenState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'active'; exerciseSet: GrammarExerciseSet; currentIndex: number; questionStates: Map<string, QuestionState> }
  | { type: 'complete'; correct: number; total: number };

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
    marginBottom: '12px',
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

  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: COLORS.border,
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '24px',
  } as React.CSSProperties,

  progressBarFill: (percentage: number): React.CSSProperties => ({
    width: `${percentage}%`,
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  }),

  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '20px',
  } as React.CSSProperties,

  sentenceText: {
    fontSize: '16px',
    fontWeight: 500,
    color: COLORS.dark,
    lineHeight: 1.7,
    marginBottom: '20px',
  } as React.CSSProperties,

  optionsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,

  optionButton: (isSelected: boolean, isDisabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '14px 18px',
    border: `2px solid ${isSelected ? COLORS.primary : COLORS.border}`,
    borderRadius: '10px',
    backgroundColor: isSelected ? COLORS.primaryLight : COLORS.white,
    cursor: isDisabled ? 'default' : 'pointer',
    textAlign: 'left' as const,
    fontSize: '13px',
    color: COLORS.dark,
    fontWeight: isSelected ? 600 : 400,
    transition: 'border-color 0.15s, background-color 0.15s',
    opacity: isDisabled && !isSelected ? 0.6 : 1,
  }),

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
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
  }),

  feedbackText: {
    fontSize: '13px',
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  grammarRule: {
    fontSize: '12px',
    color: COLORS.muted,
    fontStyle: 'italic' as const,
    margin: '8px 0 0 0',
    paddingTop: '8px',
    borderTop: `1px solid ${COLORS.border}`,
  } as React.CSSProperties,

  correctAnswer: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.green,
    margin: '4px 0',
  } as React.CSSProperties,

  nextButton: (disabled: boolean): React.CSSProperties => ({
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

  errorIcon: {
    fontSize: '40px',
    marginBottom: '8px',
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

  validatingText: {
    fontSize: '12px',
    color: COLORS.muted,
    fontStyle: 'italic' as const,
    marginTop: '12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
} as const;

// ============================================================
// CSS Animations (injected via <style>)
// ============================================================

const ANIMATIONS_CSS = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Renders the sentence with the blank placeholder styled as a visible underscore.
 * Looks for "___" (3+ underscores) or "____" patterns and renders them as a styled span.
 */
export function renderSentenceWithBlank(sentence: string): React.ReactNode[] {
  const parts = sentence.split(/(_{2,})/);
  return parts.map((part, index) => {
    if (/^_{2,}$/.test(part)) {
      return (
        <span
          key={index}
          style={{
            display: 'inline-block',
            minWidth: '60px',
            borderBottom: `2px solid ${COLORS.dark}`,
            marginLeft: '4px',
            marginRight: '4px',
            textAlign: 'center',
          }}
          aria-label="blank"
        >
          {'\u00A0\u00A0\u00A0\u00A0'}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * Calculate progress percentage for the progress bar.
 * Requirement 13.2: Progress = answered questions / total questions × 100.
 */
export function calculateProgressPercentage(answeredCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((answeredCount / totalCount) * 100);
}

/**
 * Get performance message based on score.
 */
function getPerformanceMessage(correct: number, total: number): string {
  const percentage = total > 0 ? (correct / total) * 100 : 0;
  if (percentage === 100) return 'Perfect score! You have excellent grammar skills!';
  if (percentage >= 80) return 'Great job! You have a strong understanding of grammar rules.';
  if (percentage >= 60) return 'Good effort! Keep practicing to strengthen your grammar.';
  if (percentage >= 40) return 'You\'re making progress! Review the grammar rules and try again.';
  return 'Keep learning! Practice makes perfect. Review the explanations and try again.';
}

// ============================================================
// Sub-Components
// ============================================================

/** Loading state view */
const LoadingView: React.FC = () => (
  <div style={styles.loadingContainer} role="status" aria-label="Loading exercises">
    <div style={styles.loadingSpinner} />
    <p style={styles.loadingText}>Loading grammar exercises...</p>
  </div>
);

/** Error state view with retry (Req 13.11) */
const ErrorView: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={styles.errorContainer} role="alert" aria-live="assertive">
    <div style={styles.errorIcon} aria-hidden="true">⚠️</div>
    <p style={styles.errorText}>{message}</p>
    <button
      style={styles.retryButton}
      onClick={onRetry}
      aria-label="Retry loading exercises"
    >
      Try Again
    </button>
  </div>
);

/** Completion summary view (Req 13.10) */
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
      <h2 style={styles.summaryTitle}>Grammar Exercise Complete!</h2>
      <div
        style={styles.summaryScore(correct, total)}
        aria-label={`Score: ${correct} out of ${total} correct`}
      >
        {correct}/{total}
      </div>
      <p style={styles.summaryMessage}>
        {getPerformanceMessage(correct, total)}
        <br />
        You scored {percentage}% on this exercise set.
      </p>
      {onBack && (
        <button
          style={styles.summaryBackButton}
          onClick={onBack}
          aria-label="Return to exercises"
        >
          Done
        </button>
      )}
    </div>
  );
};

/** Feedback panel shown after answer selection (Req 13.6, 13.7) */
const FeedbackPanel: React.FC<{ validation: GrammarValidationResponse }> = ({ validation }) => (
  <div
    style={styles.feedbackPanel(validation.isCorrect)}
    role="alert"
    aria-live="polite"
    aria-label={validation.isCorrect ? 'Correct answer feedback' : 'Incorrect answer feedback'}
  >
    <div style={styles.feedbackTitle(validation.isCorrect)}>
      {validation.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
    </div>
    {!validation.isCorrect && (
      <p style={styles.correctAnswer}>
        Correct answer: {validation.correctAnswer}
      </p>
    )}
    <p style={styles.feedbackText}>{validation.feedback}</p>
    {validation.grammarRule && (
      <p style={styles.grammarRule}>
        📖 Grammar rule: {validation.grammarRule}
      </p>
    )}
  </div>
);

// ============================================================
// Main Component
// ============================================================

export const GrammarExerciseScreen: React.FC<GrammarExerciseScreenProps> = ({
  fetchExercises,
  validateAnswer,
  onBack,
  onComplete,
}) => {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'loading' });

  // Load exercise data
  const loadExercises = useCallback(async () => {
    setScreenState({ type: 'loading' });
    try {
      const exerciseSet = await fetchExercises();
      if (exerciseSet.questions.length === 0) {
        setScreenState({
          type: 'error',
          message: 'No grammar exercises available for this chapter.',
        });
        return;
      }
      const questionStates = new Map<string, QuestionState>();
      for (const q of exerciseSet.questions) {
        questionStates.set(q.id, {
          selectedOption: null,
          validation: null,
          validationLoading: false,
        });
      }
      setScreenState({
        type: 'active',
        exerciseSet,
        currentIndex: 0,
        questionStates,
      });
    } catch {
      setScreenState({
        type: 'error',
        message: 'Unable to load grammar exercises. Please check your connection and try again.',
      });
    }
  }, [fetchExercises]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  // Handle option selection (Req 13.5)
  const handleOptionSelect = useCallback(async (optionIndex: number) => {
    if (screenState.type !== 'active') return;

    const { exerciseSet, currentIndex, questionStates } = screenState;
    const currentQuestion = exerciseSet.questions[currentIndex];
    const currentState = questionStates.get(currentQuestion.id);

    // If already answered, do nothing
    if (currentState?.validation || currentState?.validationLoading) return;

    const selectedOption = currentQuestion.options[optionIndex];

    // Update to show selection and loading state
    const updatedStates = new Map(questionStates);
    updatedStates.set(currentQuestion.id, {
      selectedOption: optionIndex,
      validation: null,
      validationLoading: true,
    });
    setScreenState({
      ...screenState,
      questionStates: updatedStates,
    });

    // Call validation API
    try {
      const result = await validateAnswer(exerciseSet.id, currentQuestion.id, selectedOption);
      setScreenState((prev) => {
        if (prev.type !== 'active') return prev;
        const newStates = new Map(prev.questionStates);
        newStates.set(currentQuestion.id, {
          selectedOption: optionIndex,
          validation: result,
          validationLoading: false,
        });
        return { ...prev, questionStates: newStates };
      });
    } catch {
      // On validation failure, still show the selection but no feedback
      setScreenState((prev) => {
        if (prev.type !== 'active') return prev;
        const newStates = new Map(prev.questionStates);
        newStates.set(currentQuestion.id, {
          selectedOption: optionIndex,
          validation: {
            isCorrect: false,
            correctAnswer: '',
            feedback: 'Unable to validate your answer. Please try the next question.',
            grammarRule: '',
          },
          validationLoading: false,
        });
        return { ...prev, questionStates: newStates };
      });
    }
  }, [screenState, validateAnswer]);

  // Handle Next button (Req 13.9, 13.10)
  const handleNext = useCallback(() => {
    if (screenState.type !== 'active') return;

    const { exerciseSet, currentIndex, questionStates } = screenState;
    const isLastQuestion = currentIndex === exerciseSet.questions.length - 1;

    if (isLastQuestion) {
      // Calculate score and show completion (Req 13.10)
      let correct = 0;
      for (const state of questionStates.values()) {
        if (state.validation?.isCorrect) {
          correct++;
        }
      }
      const total = exerciseSet.questions.length;
      setScreenState({ type: 'complete', correct, total });
      onComplete?.({ correct, total });
    } else {
      // Advance to next question (Req 13.9)
      setScreenState({
        ...screenState,
        currentIndex: currentIndex + 1,
      });
    }
  }, [screenState, onComplete]);

  // Compute answered count for progress bar
  const answeredCount = useMemo(() => {
    if (screenState.type !== 'active') return 0;
    let count = 0;
    for (const state of screenState.questionStates.values()) {
      if (state.validation !== null) count++;
    }
    return count;
  }, [screenState]);

  // ============================================================
  // Render
  // ============================================================

  // Loading state
  if (screenState.type === 'loading') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <LoadingView />
        </div>
      </>
    );
  }

  // Error state (Req 13.11)
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

  // Completion state (Req 13.10)
  if (screenState.type === 'complete') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <CompletionView
            correct={screenState.correct}
            total={screenState.total}
            onBack={onBack}
          />
        </div>
      </>
    );
  }

  // Active question state
  const { exerciseSet, currentIndex, questionStates } = screenState;
  const currentQuestion = exerciseSet.questions[currentIndex];
  const currentQuestionState = questionStates.get(currentQuestion.id)!;
  const totalQuestions = exerciseSet.questions.length;
  const progressPercentage = calculateProgressPercentage(answeredCount, totalQuestions);
  const isAnswered = currentQuestionState.validation !== null;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <>
      <style>{ANIMATIONS_CSS}</style>
      <div style={styles.container} data-testid="grammar-exercise-screen">
        {/* Header with counter and back button (Req 13.1) */}
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

        {/* Progress bar (Req 13.2) */}
        <div
          style={styles.progressBarContainer}
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${progressPercentage}% complete`}
        >
          <div style={styles.progressBarFill(progressPercentage)} />
        </div>

        {/* Question card */}
        <div style={styles.questionCard}>
          {/* Sentence with blank placeholder (Req 13.3) */}
          <p style={styles.sentenceText} aria-label="Exercise sentence">
            {renderSentenceWithBlank(currentQuestion.sentence)}
          </p>

          {/* Multiple-choice options (Req 13.4) */}
          <div
            style={styles.optionsContainer}
            role="radiogroup"
            aria-label="Answer options"
          >
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                style={styles.optionButton(
                  currentQuestionState.selectedOption === idx,
                  isAnswered && currentQuestionState.selectedOption !== idx,
                )}
                onClick={() => handleOptionSelect(idx)}
                disabled={isAnswered || currentQuestionState.validationLoading}
                role="radio"
                aria-checked={currentQuestionState.selectedOption === idx}
                aria-label={`Option ${idx + 1}: ${option}`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Validation loading indicator */}
          {currentQuestionState.validationLoading && (
            <p style={styles.validatingText} role="status">Checking your answer...</p>
          )}

          {/* Feedback panel (Req 13.5, 13.6, 13.7) */}
          {currentQuestionState.validation && (
            <FeedbackPanel validation={currentQuestionState.validation} />
          )}
        </div>

        {/* Next button (Req 13.8, 13.9, 13.10) */}
        <button
          style={styles.nextButton(!isAnswered)}
          onClick={handleNext}
          disabled={!isAnswered}
          aria-label={isLastQuestion ? 'Finish and see results' : 'Next question'}
        >
          {isLastQuestion ? 'See Results' : 'Next →'}
        </button>
      </div>
    </>
  );
};

export default GrammarExerciseScreen;
