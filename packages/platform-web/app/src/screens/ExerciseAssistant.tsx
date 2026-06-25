/**
 * ExerciseAssistant — AI-powered exercise assistance screen for ChikuMiku LearnVerse.
 *
 * Displays exercises parsed from textbook pages with answer interfaces,
 * contextual hint system (RAG-based), answer evaluation with feedback,
 * and completion summary with score.
 *
 * Route: /chapters/:chapterId/exercises
 *
 * Validates: Requirements 11.1–11.10
 */

import React, { useCallback, useMemo, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export type ExerciseItemType =
  | 'fill_blank'
  | 'multiple_choice'
  | 'match'
  | 'true_false'
  | 'short_answer';

export interface ExerciseItem {
  id: string;
  questionText: string;
  exerciseType: ExerciseItemType;
  options?: string[]; // For MCQ / true-false
  sequenceNumber: number;
}

export interface HintResponse {
  hint: string;
  referencedSections: string[];
}

export interface EvaluateResponse {
  isCorrect: boolean;
  score: number;
  feedback: string;
  referencedSection?: string;
}

export interface ExerciseAssistantProps {
  /** Chapter ID for context */
  chapterId: string;
  /** List of exercises for this chapter */
  exercises: ExerciseItem[];
  /** Fetch a contextual hint for an exercise */
  fetchHint: (exerciseId: string, attemptNumber: number) => Promise<HintResponse>;
  /** Evaluate student answer */
  evaluateAnswer: (exerciseId: string, answer: string) => Promise<EvaluateResponse>;
  /** Navigate back to chapter */
  onBack?: () => void;
}

interface ExerciseState {
  answer: string;
  selectedOption: number | null;
  hint: HintResponse | null;
  hintLoading: boolean;
  evaluation: EvaluateResponse | null;
  evaluationLoading: boolean;
  attemptCount: number;
  submitted: boolean;
}

// ============================================================
// Constants
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  green: '#27AE60',
  red: '#E74C3C',
  dark: '#2C2341',
  background: '#F8F5FF',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  gold: '#F7C948',
  greenBg: '#E8F8EF',
  redBg: '#FDF2F2',
  hintBg: '#FFF8E1',
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Calculate completion score from evaluation results.
 * Returns { correct, total } counts.
 */
export function calculateScore(
  states: Map<string, ExerciseState>,
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const state of states.values()) {
    if (state.submitted && state.evaluation) {
      total++;
      if (state.evaluation.isCorrect) {
        correct++;
      }
    }
  }
  return { correct, total };
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
    maxWidth: '800px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  title: {
    fontSize: '26px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  progressText: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.muted,
  } as React.CSSProperties,

  exerciseCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
  } as React.CSSProperties,

  questionNumber: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as React.CSSProperties,

  questionText: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.dark,
    lineHeight: 1.6,
    marginBottom: '16px',
  } as React.CSSProperties,

  optionButton: (selected: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    marginBottom: '8px',
    border: `2px solid ${selected ? COLORS.primary : COLORS.border}`,
    borderRadius: '10px',
    backgroundColor: selected ? `${COLORS.primary}10` : COLORS.white,
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'left' as const,
    fontSize: '13px',
    color: COLORS.dark,
    fontWeight: selected ? 600 : 400,
    transition: 'border-color 0.15s, background-color 0.15s',
    opacity: disabled ? 0.7 : 1,
  }),

  textInput: {
    width: '100%',
    padding: '12px 16px',
    border: `2px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '13px',
    color: COLORS.dark,
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '12px',
  } as React.CSSProperties,

  buttonRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  hintButton: {
    padding: '10px 20px',
    borderRadius: '20px',
    border: `2px solid ${COLORS.gold}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  submitButton: (disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.primary,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '12px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }),

  hintBox: {
    marginTop: '12px',
    padding: '14px 16px',
    backgroundColor: COLORS.hintBg,
    borderRadius: '10px',
    borderLeft: `4px solid ${COLORS.gold}`,
  } as React.CSSProperties,

  hintLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.gold,
    textTransform: 'uppercase' as const,
    marginBottom: '6px',
  } as React.CSSProperties,

  hintText: {
    fontSize: '13px',
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: 0,
  } as React.CSSProperties,

  feedbackBox: (isCorrect: boolean): React.CSSProperties => ({
    marginTop: '12px',
    padding: '14px 16px',
    backgroundColor: isCorrect ? COLORS.greenBg : COLORS.redBg,
    borderRadius: '10px',
    borderLeft: `4px solid ${isCorrect ? COLORS.green : COLORS.red}`,
  }),

  feedbackLabel: (isCorrect: boolean): React.CSSProperties => ({
    fontSize: '11px',
    fontWeight: 600,
    color: isCorrect ? COLORS.green : COLORS.red,
    textTransform: 'uppercase' as const,
    marginBottom: '6px',
  }),

  feedbackText: {
    fontSize: '13px',
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  referenceBox: {
    marginTop: '8px',
    padding: '10px 12px',
    backgroundColor: COLORS.white,
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
  } as React.CSSProperties,

  referenceLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  } as React.CSSProperties,

  referenceText: {
    fontSize: '12px',
    color: COLORS.dark,
    lineHeight: 1.4,
    margin: 0,
    fontStyle: 'italic' as const,
  } as React.CSSProperties,

  summaryContainer: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '32px 24px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
  } as React.CSSProperties,

  summaryTitle: {
    fontSize: '26px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '12px',
  } as React.CSSProperties,

  summaryScore: (correct: number, total: number): React.CSSProperties => ({
    fontSize: '48px',
    fontWeight: 700,
    color: correct === total ? COLORS.green : correct >= total / 2 ? COLORS.gold : COLORS.red,
    margin: '16px 0',
  }),

  summaryLabel: {
    fontSize: '13px',
    color: COLORS.muted,
    marginBottom: '24px',
  } as React.CSSProperties,

  backButton: {
    padding: '12px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  loadingSpinner: {
    fontSize: '12px',
    color: COLORS.muted,
    fontStyle: 'italic' as const,
    marginTop: '8px',
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 24px',
    color: COLORS.muted,
    fontSize: '14px',
  } as React.CSSProperties,
} as const;

// ============================================================
// Sub-Components
// ============================================================

/** Individual exercise card with answer interface */
const ExerciseCard: React.FC<{
  exercise: ExerciseItem;
  state: ExerciseState;
  onAnswerChange: (id: string, value: string) => void;
  onOptionSelect: (id: string, index: number) => void;
  onGetHint: (id: string) => void;
  onSubmit: (id: string) => void;
}> = ({ exercise, state, onAnswerChange, onOptionSelect, onGetHint, onSubmit }) => {
  const isMcq = exercise.exerciseType === 'multiple_choice' || exercise.exerciseType === 'true_false';
  const hasOptions = !!exercise.options && exercise.options.length > 0;
  const canSubmit = isMcq && hasOptions
    ? state.selectedOption !== null && !state.submitted
    : state.answer.trim().length > 0 && !state.submitted;

  return (
    <div style={styles.exerciseCard} role="article" aria-label={`Exercise ${exercise.sequenceNumber}`}>
      <div style={styles.questionNumber}>
        Question {exercise.sequenceNumber}
      </div>
      <div style={styles.questionText}>{exercise.questionText}</div>

      {/* Answer Interface */}
      {isMcq && hasOptions ? (
        <div role="radiogroup" aria-label="Answer options">
          {exercise.options!.map((option, idx) => (
            <button
              key={idx}
              style={styles.optionButton(state.selectedOption === idx, state.submitted)}
              onClick={() => !state.submitted && onOptionSelect(exercise.id, idx)}
              disabled={state.submitted}
              role="radio"
              aria-checked={state.selectedOption === idx}
              aria-label={`Option ${String.fromCharCode(65 + idx)}: ${option}`}
            >
              <strong>{String.fromCharCode(65 + idx)}.</strong> {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="text"
          style={styles.textInput}
          placeholder="Type your answer here..."
          value={state.answer}
          onChange={(e) => onAnswerChange(exercise.id, e.target.value)}
          disabled={state.submitted}
          aria-label="Your answer"
        />
      )}

      {/* Action Buttons */}
      {!state.submitted && (
        <div style={styles.buttonRow}>
          <button
            style={styles.hintButton}
            onClick={() => onGetHint(exercise.id)}
            disabled={state.hintLoading}
            aria-label="Get Hint"
          >
            {state.hintLoading ? 'Loading...' : '💡 Get Hint'}
          </button>
          <button
            style={styles.submitButton(!canSubmit)}
            onClick={() => canSubmit && onSubmit(exercise.id)}
            disabled={!canSubmit}
            aria-label="Submit answer"
          >
            Submit Answer
          </button>
        </div>
      )}

      {/* Hint Display */}
      {state.hint && (
        <div style={styles.hintBox} role="note" aria-label="Hint">
          <div style={styles.hintLabel}>💡 Hint</div>
          <p style={styles.hintText}>{state.hint.hint}</p>
        </div>
      )}

      {/* Feedback Display */}
      {state.evaluation && (
        <div
          style={styles.feedbackBox(state.evaluation.isCorrect)}
          role="alert"
          aria-label={state.evaluation.isCorrect ? 'Correct answer' : 'Incorrect answer'}
        >
          <div style={styles.feedbackLabel(state.evaluation.isCorrect)}>
            {state.evaluation.isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </div>
          <p style={styles.feedbackText}>{state.evaluation.feedback}</p>

          {/* Referenced section for incorrect answers (Req 11.7) */}
          {!state.evaluation.isCorrect && state.evaluation.referencedSection && (
            <div style={styles.referenceBox}>
              <div style={styles.referenceLabel}>📖 Review this section</div>
              <p style={styles.referenceText}>{state.evaluation.referencedSection}</p>
            </div>
          )}
        </div>
      )}

      {/* Loading indicators */}
      {state.evaluationLoading && (
        <div style={styles.loadingSpinner} role="status">Evaluating your answer...</div>
      )}
    </div>
  );
};

/** Completion summary shown when all exercises are answered */
const CompletionSummary: React.FC<{
  correct: number;
  total: number;
  onBack?: () => void;
}> = ({ correct, total, onBack }) => (
  <div style={styles.summaryContainer} role="region" aria-label="Exercise completion summary">
    <h2 style={styles.summaryTitle}>Exercises Complete!</h2>
    <div style={styles.summaryScore(correct, total)} aria-label={`Score: ${correct} out of ${total}`}>
      {correct}/{total}
    </div>
    <p style={styles.summaryLabel}>
      {correct === total
        ? 'Perfect score! Great work!'
        : correct >= total / 2
          ? 'Good effort! Review the referenced sections for improvement.'
          : 'Keep practicing! Review the highlighted chapter sections.'}
    </p>
    {onBack && (
      <button style={styles.backButton} onClick={onBack} aria-label="Back to chapter">
        Back to Chapter
      </button>
    )}
  </div>
);

// ============================================================
// Main Component
// ============================================================

export const ExerciseAssistant: React.FC<ExerciseAssistantProps> = ({
  chapterId,
  exercises,
  fetchHint,
  evaluateAnswer,
  onBack,
}) => {
  const [exerciseStates, setExerciseStates] = useState<Map<string, ExerciseState>>(() => {
    const map = new Map<string, ExerciseState>();
    for (const ex of exercises) {
      map.set(ex.id, {
        answer: '',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        evaluationLoading: false,
        attemptCount: 0,
        submitted: false,
      });
    }
    return map;
  });

  const updateState = useCallback((id: string, updates: Partial<ExerciseState>) => {
    setExerciseStates((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) {
        next.set(id, { ...current, ...updates });
      }
      return next;
    });
  }, []);

  // Track answer text changes (for text-based exercises)
  const handleAnswerChange = useCallback((id: string, value: string) => {
    updateState(id, { answer: value });
  }, [updateState]);

  // Track MCQ option selection
  const handleOptionSelect = useCallback((id: string, index: number) => {
    const exercise = exercises.find((e) => e.id === id);
    if (exercise?.options) {
      updateState(id, { selectedOption: index, answer: exercise.options[index] });
    }
  }, [exercises, updateState]);

  // Request a hint
  const handleGetHint = useCallback(async (id: string) => {
    const current = exerciseStates.get(id);
    if (!current || current.hintLoading) return;

    const attemptNumber = current.attemptCount + 1;
    updateState(id, { hintLoading: true, attemptCount: attemptNumber });

    try {
      const hint = await fetchHint(id, attemptNumber);
      updateState(id, {
        hint: { hint: hint.hint, referencedSections: hint.referencedSections },
        hintLoading: false,
      });
    } catch {
      updateState(id, { hintLoading: false });
    }
  }, [exerciseStates, fetchHint, updateState]);

  // Submit answer for evaluation
  const handleSubmit = useCallback(async (id: string) => {
    const current = exerciseStates.get(id);
    if (!current || current.submitted || current.evaluationLoading) return;

    const answer = current.answer;
    if (!answer.trim()) return;

    updateState(id, { evaluationLoading: true });

    try {
      const result = await evaluateAnswer(id, answer);
      updateState(id, {
        evaluation: result,
        evaluationLoading: false,
        submitted: true,
      });
    } catch {
      updateState(id, { evaluationLoading: false });
    }
  }, [exerciseStates, evaluateAnswer, updateState]);

  // Calculate score and completion status
  const { correct, total } = useMemo(
    () => calculateScore(exerciseStates),
    [exerciseStates],
  );

  const allSubmitted = useMemo(
    () => exercises.length > 0 && exercises.every((ex) => exerciseStates.get(ex.id)?.submitted),
    [exercises, exerciseStates],
  );

  // Empty state
  if (exercises.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState} role="status">
          <p>No exercises found for this chapter.</p>
          {onBack && (
            <button style={styles.backButton} onClick={onBack}>Back to Chapter</button>
          )}
        </div>
      </div>
    );
  }

  // Completion summary (Req 11.10)
  if (allSubmitted) {
    return (
      <div style={styles.container}>
        <CompletionSummary correct={correct} total={total} onBack={onBack} />
      </div>
    );
  }

  // Main exercise view
  return (
    <div style={styles.container} data-testid="exercise-assistant" data-chapter-id={chapterId}>
      <header style={styles.header}>
        <h1 style={styles.title}>Exercises</h1>
        <span style={styles.progressText}>
          {total}/{exercises.length} answered
        </span>
      </header>

      {exercises.map((exercise) => {
        const state = exerciseStates.get(exercise.id);
        if (!state) return null;
        return (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            state={state}
            onAnswerChange={handleAnswerChange}
            onOptionSelect={handleOptionSelect}
            onGetHint={handleGetHint}
            onSubmit={handleSubmit}
          />
        );
      })}
    </div>
  );
};

export default ExerciseAssistant;
