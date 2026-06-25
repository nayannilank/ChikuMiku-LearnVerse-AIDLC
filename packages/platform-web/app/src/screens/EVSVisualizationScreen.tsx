/**
 * EVSVisualizationScreen — EVS interactive visualization screen for ChikuMiku LearnVerse.
 *
 * Displays animated scientific visualizations with:
 * - Animated emoji/icon sequences looping continuously (Req 17.1)
 * - Labeled stage descriptions (3-8 stages) (Req 17.2)
 * - Drag-and-drop ordering exercise with randomized initial order (Req 17.3)
 * - "Check Order" button validates arrangement (Req 17.4)
 * - Correct items green with checkmarks (Req 17.5)
 * - Incorrect items in default blue (Req 17.6)
 * - EVS quiz: MCQ with scientific explanation on correct answer (Req 17.7, 17.8)
 *
 * Route: /exercises/evs
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface EVSStage {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface EVSVisualization {
  id: string;
  title: string;
  stages: EVSStage[];
}

export interface EVSQuizQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  scientificExplanation: string;
}

export interface EVSExerciseData {
  visualization: EVSVisualization;
  quizQuestions: EVSQuizQuestion[];
}

export interface OrderValidationResult {
  perItemCorrectness: boolean[];
  allCorrect: boolean;
}

export interface EVSVisualizationScreenProps {
  /** Fetch EVS exercise data */
  fetchExerciseData: () => Promise<EVSExerciseData>;
  /** Validate student's ordering */
  validateOrder: (visualizationId: string, stageIds: string[]) => Promise<OrderValidationResult>;
  /** Navigate back */
  onBack?: () => void;
}

// ============================================================
// Exported Helper Functions (for property testing)
// ============================================================

/**
 * Shuffles an array of stages using Fisher-Yates algorithm.
 * Ensures the shuffled order differs from the original when possible (stages.length > 1).
 * Requirement 17.3: Stages initially presented in a randomized order.
 */
export function shuffleStages<T>(stages: T[]): T[] {
  if (stages.length <= 1) return [...stages];

  const shuffled = [...stages];
  let attempts = 0;
  const maxAttempts = 10;

  do {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (
    attempts < maxAttempts &&
    shuffled.every((item, idx) => item === stages[idx])
  );

  return shuffled;
}

/**
 * Validates the student's ordering against the correct order.
 * Returns per-item correctness and whether all items are correct.
 * Requirement 17.4, 17.5, 17.6: Per-item correctness marking.
 */
export function validateOrderLocal(
  studentOrder: string[],
  correctOrder: string[]
): OrderValidationResult {
  const perItemCorrectness = studentOrder.map(
    (id, index) => id === correctOrder[index]
  );
  const allCorrect = perItemCorrectness.every(Boolean);
  return { perItemCorrectness, allCorrect };
}

// ============================================================
// Constants
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  green: '#27AE60',
  greenBg: '#E8F8EF',
  evsGreen: '#27AE60',
  dark: '#2C2341',
  background: '#F8F5FF',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  blue: '#5DADE2',
  blueBg: '#EBF5FB',
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
    maxWidth: '800px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  } as React.CSSProperties,

  title: {
    fontSize: '18px',
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

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  // Animation area
  animationCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '24px',
    textAlign: 'center' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  animationSequence: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '32px',
    minHeight: '60px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  animationArrow: {
    fontSize: '20px',
    color: COLORS.muted,
  } as React.CSSProperties,

  highlightedEmoji: {
    transform: 'scale(1.3)',
    transition: 'transform 0.3s ease',
  } as React.CSSProperties,

  stageLabels: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    justifyContent: 'center',
    marginTop: '16px',
  } as React.CSSProperties,

  stageLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '10px',
    backgroundColor: COLORS.background,
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
  } as React.CSSProperties,

  // Ordering section
  orderingCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '24px',
  } as React.CSSProperties,

  orderingList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,

  orderItem: (status: 'default' | 'correct' | 'incorrect', isDragging: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: `2px solid ${
      status === 'correct' ? COLORS.green :
      status === 'incorrect' ? COLORS.blue :
      COLORS.border
    }`,
    backgroundColor:
      status === 'correct' ? COLORS.greenBg :
      status === 'incorrect' ? COLORS.blueBg :
      COLORS.white,
    cursor: 'grab',
    opacity: isDragging ? 0.5 : 1,
    transition: 'all 0.2s ease',
    userSelect: 'none' as const,
  }),

  orderItemNumber: (status: 'default' | 'correct' | 'incorrect'): React.CSSProperties => ({
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      status === 'correct' ? COLORS.green :
      status === 'incorrect' ? COLORS.blue :
      COLORS.border,
    color: status === 'default' ? COLORS.dark : COLORS.white,
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  }),

  orderItemEmoji: {
    fontSize: '20px',
    flexShrink: 0,
  } as React.CSSProperties,

  orderItemLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: COLORS.dark,
    flex: 1,
  } as React.CSSProperties,

  orderItemCheck: {
    fontSize: '16px',
    color: COLORS.green,
    fontWeight: 700,
  } as React.CSSProperties,

  dragHandle: {
    fontSize: '14px',
    color: COLORS.muted,
    cursor: 'grab',
  } as React.CSSProperties,

  checkButton: (disabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.evsGreen,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background-color 0.15s',
  }),

  // Quiz section
  quizCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '24px',
  } as React.CSSProperties,

  quizQuestionText: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.dark,
    lineHeight: 1.6,
    marginBottom: '16px',
  } as React.CSSProperties,

  quizOptions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  quizOption: (isSelected: boolean, isCorrect: boolean | null): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    border: `2px solid ${
      isCorrect === true ? COLORS.green :
      isSelected ? COLORS.primary :
      COLORS.border
    }`,
    borderRadius: '10px',
    backgroundColor:
      isCorrect === true ? COLORS.greenBg :
      isSelected ? '#E94F9B10' :
      COLORS.white,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontSize: '13px',
    color: COLORS.dark,
    transition: 'all 0.15s',
  }),

  quizOptionLabel: (isSelected: boolean): React.CSSProperties => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSelected ? COLORS.primary : COLORS.background,
    color: isSelected ? COLORS.white : COLORS.dark,
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  }),

  explanationPanel: {
    marginTop: '12px',
    padding: '14px 16px',
    backgroundColor: COLORS.greenBg,
    borderRadius: '10px',
    borderLeft: `4px solid ${COLORS.green}`,
  } as React.CSSProperties,

  explanationTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.green,
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  explanationText: {
    fontSize: '12px',
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: 0,
  } as React.CSSProperties,

  quizCounter: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.muted,
    marginBottom: '12px',
  } as React.CSSProperties,

  quizNextButton: (disabled: boolean): React.CSSProperties => ({
    marginTop: '16px',
    padding: '12px 20px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.evsGreen,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }),

  // Loading & Error
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
  } as React.CSSProperties,

  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${COLORS.border}`,
    borderTopColor: COLORS.evsGreen,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  loadingText: {
    fontSize: '14px',
    color: COLORS.muted,
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
    color: '#E74C3C',
    maxWidth: '300px',
  } as React.CSSProperties,

  retryButton: {
    padding: '12px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.evsGreen,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  successBanner: {
    padding: '14px 18px',
    backgroundColor: COLORS.greenBg,
    borderRadius: '10px',
    border: `2px solid ${COLORS.green}`,
    textAlign: 'center' as const,
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.green,
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
  @keyframes pulse-emoji {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
`;

// ============================================================
// Sub-Components
// ============================================================

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

/** Animated visualization showing emoji sequence (Req 17.1) */
const AnimatedVisualization: React.FC<{
  stages: EVSStage[];
}> = ({ stages }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % stages.length);
    }, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stages.length]);

  return (
    <div style={styles.animationCard} role="img" aria-label="Animated scientific process visualization">
      <div style={styles.animationSequence}>
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <span
              style={idx === activeIndex ? { ...styles.highlightedEmoji, display: 'inline-block', animation: 'pulse-emoji 1.5s ease-in-out infinite' } : { display: 'inline-block' }}
              aria-label={stage.label}
            >
              {stage.emoji}
            </span>
            {idx < stages.length - 1 && (
              <span style={styles.animationArrow} aria-hidden="true">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Labeled stage descriptions (Req 17.2) */}
      <div style={styles.stageLabels}>
        {stages.map((stage) => (
          <span key={stage.id} style={styles.stageLabel}>
            <span aria-hidden="true">{stage.emoji}</span>
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/** EVS Quiz section (Req 17.7, 17.8) */
const EVSQuiz: React.FC<{
  questions: EVSQuizQuestion[];
}> = ({ questions }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedOption(index);
    if (index === currentQuestion.correctOptionIndex) {
      setShowExplanation(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    }
  };

  return (
    <div style={styles.quizCard} role="region" aria-label="EVS Quiz">
      <div style={styles.sectionTitle}>🌿 EVS Quiz</div>
      <div style={styles.quizCounter}>
        Question {currentIndex + 1}/{questions.length}
      </div>
      <p style={styles.quizQuestionText}>{currentQuestion.questionText}</p>

      <div style={styles.quizOptions} role="radiogroup" aria-label="Answer options">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = showExplanation && idx === currentQuestion.correctOptionIndex ? true : null;
          return (
            <button
              key={idx}
              style={styles.quizOption(isSelected, isCorrect)}
              onClick={() => handleOptionSelect(idx)}
              disabled={showExplanation}
              role="radio"
              aria-checked={isSelected}
              aria-label={`Option ${OPTION_LABELS[idx]}: ${option}`}
            >
              <span style={styles.quizOptionLabel(isSelected)}>{OPTION_LABELS[idx]}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {/* Scientific explanation on correct answer (Req 17.8) */}
      {showExplanation && (
        <div style={styles.explanationPanel} role="alert" aria-live="polite">
          <div style={styles.explanationTitle}>✓ Correct — Scientific Explanation</div>
          <p style={styles.explanationText}>{currentQuestion.scientificExplanation}</p>
        </div>
      )}

      {showExplanation && currentIndex < questions.length - 1 && (
        <button
          style={styles.quizNextButton(false)}
          onClick={handleNext}
          aria-label="Next question"
        >
          Next →
        </button>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const EVSVisualizationScreen: React.FC<EVSVisualizationScreenProps> = ({
  fetchExerciseData,
  validateOrder,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exerciseData, setExerciseData] = useState<EVSExerciseData | null>(null);
  const [orderedStages, setOrderedStages] = useState<EVSStage[]>([]);
  const [validationResult, setValidationResult] = useState<OrderValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Load exercise data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExerciseData();
      setExerciseData(data);
      // Randomize initial order (Req 17.3)
      setOrderedStages(shuffleStages(data.visualization.stages));
      setValidationResult(null);
    } catch {
      setError('Unable to load EVS exercise. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchExerciseData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Correct order IDs for validation
  const correctOrderIds = useMemo(
    () => exerciseData?.visualization.stages.map((s) => s.id) ?? [],
    [exerciseData]
  );

  // Handle Check Order (Req 17.4)
  const handleCheckOrder = useCallback(async () => {
    if (!exerciseData || validating) return;
    setValidating(true);
    try {
      const studentOrderIds = orderedStages.map((s) => s.id);
      const result = await validateOrder(exerciseData.visualization.id, studentOrderIds);
      setValidationResult(result);
    } catch {
      // Fallback to local validation
      const studentOrderIds = orderedStages.map((s) => s.id);
      const result = validateOrderLocal(studentOrderIds, correctOrderIds);
      setValidationResult(result);
    } finally {
      setValidating(false);
    }
  }, [exerciseData, orderedStages, validateOrder, validating, correctOrderIds]);

  // Drag-and-drop handlers (Req 17.3)
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    setOrderedStages((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, removed);
      return updated;
    });
    setDragIndex(null);
    // Clear previous validation when order changes
    setValidationResult(null);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  // Get item status for styling (Req 17.5, 17.6)
  const getItemStatus = (index: number): 'default' | 'correct' | 'incorrect' => {
    if (!validationResult) return 'default';
    return validationResult.perItemCorrectness[index] ? 'correct' : 'incorrect';
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <div style={styles.loadingContainer} role="status" aria-label="Loading EVS exercise">
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Loading visualization...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !exerciseData) {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <div style={styles.errorContainer} role="alert" aria-live="assertive">
            <div style={{ fontSize: '40px' }} aria-hidden="true">⚠️</div>
            <p style={styles.errorText}>{error ?? 'Something went wrong.'}</p>
            <button style={styles.retryButton} onClick={loadData} aria-label="Retry">
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{ANIMATIONS_CSS}</style>
      <div style={styles.container} data-testid="evs-visualization-screen">
        {/* Header */}
        <header style={styles.header}>
          <span style={styles.title}>{exerciseData.visualization.title}</span>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} aria-label="Back">
              ← Back
            </button>
          )}
        </header>

        {/* Animated Visualization (Req 17.1, 17.2) */}
        <AnimatedVisualization stages={exerciseData.visualization.stages} />

        {/* Drag-and-Drop Ordering Exercise (Req 17.3) */}
        <div style={styles.orderingCard} role="region" aria-label="Stage ordering exercise">
          <div style={styles.sectionTitle}>🔢 Arrange in Correct Order</div>

          {validationResult?.allCorrect && (
            <div style={styles.successBanner} role="status">
              🎉 All stages in correct order!
            </div>
          )}

          <div style={styles.orderingList} role="list" aria-label="Draggable stage list">
            {orderedStages.map((stage, index) => {
              const status = getItemStatus(index);
              const isDragging = dragIndex === index;
              return (
                <div
                  key={stage.id}
                  style={styles.orderItem(status, isDragging)}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  role="listitem"
                  aria-label={`Stage ${index + 1}: ${stage.label}${status === 'correct' ? ' (correct)' : status === 'incorrect' ? ' (incorrect position)' : ''}`}
                >
                  <span style={styles.orderItemNumber(status)}>
                    {status === 'correct' ? '✓' : index + 1}
                  </span>
                  <span style={styles.orderItemEmoji} aria-hidden="true">{stage.emoji}</span>
                  <span style={styles.orderItemLabel}>{stage.description}</span>
                  <span style={styles.dragHandle} aria-hidden="true">⠿</span>
                </div>
              );
            })}
          </div>

          {/* Check Order button (Req 17.4) */}
          <button
            style={styles.checkButton(validating)}
            onClick={handleCheckOrder}
            disabled={validating}
            aria-label="Check Order"
          >
            {validating ? 'Checking...' : 'Check Order'}
          </button>
        </div>

        {/* EVS Quiz Section (Req 17.7, 17.8) */}
        {exerciseData.quizQuestions.length > 0 && (
          <EVSQuiz questions={exerciseData.quizQuestions} />
        )}
      </div>
    </>
  );
};

export default EVSVisualizationScreen;
