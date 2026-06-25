/**
 * ComputersExerciseScreen — Code editor + drag-and-drop matching exercise for ChikuMiku LearnVerse.
 *
 * Displays a programming exercise with:
 * - Code editor section with syntax highlighting (Req 16.1)
 * - Drag-and-drop matching exercise with 3-8 pairs (Req 16.2)
 * - "Check Matches" button shows remaining count if incomplete (Req 16.3)
 * - All matched → validate → green (correct) / red (incorrect) indicators (Req 16.4, 16.5)
 * - "Reset" button clears all matches (Req 16.6)
 * - Completion state showing score
 *
 * Route: /exercises/computers
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import React, { useCallback, useEffect, useState } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface MatchPair {
  id: string;
  term: string;
  definition: string;
}

export interface CodeSnippet {
  language: string;
  code: string;
  title?: string;
}

export interface ComputersExerciseData {
  id: string;
  subjectId: string;
  chapterId?: string;
  codeSnippet: CodeSnippet;
  pairs: MatchPair[];
}

export interface MatchValidationResult {
  pairId: string;
  isCorrect: boolean;
}

export interface ComputersExerciseScreenProps {
  fetchExercise: () => Promise<ComputersExerciseData>;
  onValidateMatches: (exerciseId: string, matches: Record<string, string>) => Promise<MatchValidationResult[]>;
  onBack?: () => void;
  onComplete?: (score: { correct: number; total: number }) => void;
}

// ============================================================
// Exported Helper — validateMatches (for property testing)
// ============================================================

/**
 * A single match entry representing a user's pairing attempt.
 */
export interface MatchEntry {
  pairIndex: number;
  selectedAnswer: string;
  correctAnswer: string;
}

/**
 * Result of validation for a complete submission.
 */
export interface MatchResultEntry {
  pairIndex: number;
  isCorrect: boolean;
}

/**
 * Validates user matches against the correct solution.
 * Returns per-pair correctness and remaining count for incomplete submissions.
 *
 * @param totalPairs - Total number of pairs in the exercise (3-8)
 * @param matches - Array of MatchEntry representing user selections
 * @returns Object with `complete`, `remainingCount` (if incomplete), or `results` (if complete)
 */
export function validateMatches(
  totalPairs: number,
  matches: MatchEntry[],
): { complete: false; remainingCount: number } | { complete: true; results: MatchResultEntry[] } {
  const matchedCount = matches.length;

  if (matchedCount < totalPairs) {
    return {
      complete: false,
      remainingCount: totalPairs - matchedCount,
    };
  }

  // All pairs matched → validate each
  const results: MatchResultEntry[] = matches.map((entry) => ({
    pairIndex: entry.pairIndex,
    isCorrect: entry.selectedAnswer === entry.correctAnswer,
  }));

  return {
    complete: true,
    results,
  };
}

// ============================================================
// Constants
// ============================================================

const COLORS = {
  indigo: '#4A6CF7',
  indigoLight: '#4A6CF720',
  green: '#27AE60',
  greenBg: '#E8F8EF',
  red: '#E74C3C',
  redBg: '#FDF2F2',
  dark: '#2C2341',
  background: '#F8F5FF',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  codeBg: '#1E1E2E',
  codeText: '#CDD6F4',
  keyword: '#CBA6F7',
  string: '#A6E3A1',
  comment: '#6C7086',
  number: '#FAB387',
  function: '#89B4FA',
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
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
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

  codeEditorCard: {
    backgroundColor: COLORS.codeBg,
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    overflow: 'auto',
  } as React.CSSProperties,

  codeTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.comment,
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  codeContent: {
    fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", monospace',
    fontSize: '13px',
    lineHeight: 1.7,
    color: COLORS.codeText,
    whiteSpace: 'pre-wrap' as const,
    margin: 0,
  } as React.CSSProperties,

  matchingSection: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '20px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.dark,
    marginBottom: '16px',
  } as React.CSSProperties,

  matchingGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: '12px',
    alignItems: 'start',
  } as React.CSSProperties,

  column: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,

  columnHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  termItem: (isSelected: boolean, validationState?: boolean): React.CSSProperties => ({
    padding: '12px 14px',
    borderRadius: '10px',
    border: `2px solid ${
      validationState === true ? COLORS.green
        : validationState === false ? COLORS.red
        : isSelected ? COLORS.indigo : COLORS.border
    }`,
    backgroundColor:
      validationState === true ? COLORS.greenBg
        : validationState === false ? COLORS.redBg
        : isSelected ? COLORS.indigoLight : COLORS.white,
    cursor: 'pointer',
    fontSize: '13px',
    color: COLORS.dark,
    fontWeight: isSelected ? 600 : 400,
    transition: 'border-color 0.15s, background-color 0.15s',
    userSelect: 'none' as const,
  }),

  definitionItem: (isSelected: boolean, isMatched: boolean, validationState?: boolean): React.CSSProperties => ({
    padding: '12px 14px',
    borderRadius: '10px',
    border: `2px solid ${
      validationState === true ? COLORS.green
        : validationState === false ? COLORS.red
        : isSelected ? COLORS.indigo
        : isMatched ? COLORS.indigo : COLORS.border
    }`,
    backgroundColor:
      validationState === true ? COLORS.greenBg
        : validationState === false ? COLORS.redBg
        : isSelected ? COLORS.indigoLight
        : isMatched ? '#4A6CF710' : COLORS.white,
    cursor: isMatched ? 'default' : 'pointer',
    fontSize: '13px',
    color: COLORS.dark,
    fontWeight: isSelected || isMatched ? 600 : 400,
    transition: 'border-color 0.15s, background-color 0.15s',
    opacity: isMatched && !isSelected ? 0.7 : 1,
    userSelect: 'none' as const,
  }),

  connector: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    paddingTop: '28px',
  } as React.CSSProperties,

  connectorDot: (isActive: boolean): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: isActive ? COLORS.indigo : COLORS.border,
    margin: '14px 0',
  }),

  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  } as React.CSSProperties,

  checkButton: (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '14px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: disabled ? COLORS.border : COLORS.indigo,
    color: disabled ? COLORS.muted : COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background-color 0.15s',
  }),

  resetButton: {
    padding: '14px 24px',
    borderRadius: '22px',
    border: `2px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  messageBar: (type: 'info' | 'success' | 'error'): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor:
      type === 'success' ? COLORS.greenBg
        : type === 'error' ? COLORS.redBg
        : '#EEF2FF',
    border: `1px solid ${
      type === 'success' ? COLORS.green
        : type === 'error' ? COLORS.red
        : COLORS.indigo
    }`,
    fontSize: '13px',
    fontWeight: 500,
    color:
      type === 'success' ? COLORS.green
        : type === 'error' ? COLORS.red
        : COLORS.indigo,
    marginTop: '12px',
    textAlign: 'center' as const,
  }),

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
    borderTopColor: COLORS.indigo,
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
    color: COLORS.red,
    maxWidth: '300px',
  } as React.CSSProperties,

  retryButton: {
    padding: '12px 24px',
    borderRadius: '22px',
    border: 'none',
    backgroundColor: COLORS.indigo,
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
    color: correct === total ? COLORS.green : correct >= total / 2 ? COLORS.indigo : COLORS.red,
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
    backgroundColor: COLORS.indigo,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  validationIndicator: (isCorrect: boolean): React.CSSProperties => ({
    display: 'inline-block',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: isCorrect ? COLORS.green : COLORS.red,
    color: COLORS.white,
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: '18px',
    textAlign: 'center' as const,
    marginLeft: '8px',
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
`;

// ============================================================
// Syntax Highlighting Helper
// ============================================================

/**
 * Simple syntax highlighter for code display.
 * Applies color tokens to keywords, strings, comments, numbers, and functions.
 */
export function highlightCode(code: string, language: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, lineIdx) => {
    const tokens = tokenizeLine(line, language);
    return (
      <div key={lineIdx} style={{ minHeight: '1.4em' }}>
        <span style={{ color: COLORS.comment, marginRight: '12px', userSelect: 'none' as const }}>
          {String(lineIdx + 1).padStart(2, ' ')}
        </span>
        {tokens.map((token, tIdx) => (
          <span key={tIdx} style={{ color: token.color }}>{token.text}</span>
        ))}
      </div>
    );
  });
}

interface CodeToken {
  text: string;
  color: string;
}

function tokenizeLine(line: string, _language: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const keywords = /\b(function|const|let|var|if|else|return|for|while|class|import|export|from|def|print|int|string|boolean|void|new|this|true|false|null|undefined)\b/g;
  const stringPattern = /(["'`])(?:(?!\1|\\).|\\.)*\1/g;
  const commentPattern = /(\/\/.*$|#.*$)/g;
  const numberPattern = /\b\d+\.?\d*\b/g;
  const functionPattern = /\b([a-zA-Z_]\w*)\s*\(/g;

  // Simple approach: process character by character with priority
  let remaining = line;
  let pos = 0;

  while (pos < line.length) {
    remaining = line.slice(pos);

    // Check for comment
    const commentMatch = remaining.match(/^(\/\/.*|#.*)/);
    if (commentMatch) {
      tokens.push({ text: commentMatch[0], color: COLORS.comment });
      pos += commentMatch[0].length;
      continue;
    }

    // Check for string
    const strMatch = remaining.match(/^(["'`])(?:(?!\1|\\).|\\.)*\1/);
    if (strMatch) {
      tokens.push({ text: strMatch[0], color: COLORS.string });
      pos += strMatch[0].length;
      continue;
    }

    // Check for number
    const numMatch = remaining.match(/^\b\d+\.?\d*\b/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], color: COLORS.number });
      pos += numMatch[0].length;
      continue;
    }

    // Check for function call
    const fnMatch = remaining.match(/^([a-zA-Z_]\w*)\s*\(/);
    if (fnMatch) {
      tokens.push({ text: fnMatch[1], color: COLORS.function });
      pos += fnMatch[1].length;
      continue;
    }

    // Check for keyword
    const kwMatch = remaining.match(/^\b(function|const|let|var|if|else|return|for|while|class|import|export|from|def|print|int|string|boolean|void|new|this|true|false|null|undefined)\b/);
    if (kwMatch) {
      tokens.push({ text: kwMatch[0], color: COLORS.keyword });
      pos += kwMatch[0].length;
      continue;
    }

    // Default: plain text character
    tokens.push({ text: line[pos], color: COLORS.codeText });
    pos++;
  }

  // Suppress unused variable warnings
  void keywords;
  void stringPattern;
  void commentPattern;
  void numberPattern;
  void functionPattern;

  return tokens;
}

// ============================================================
// Screen State
// ============================================================

type ScreenState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'active'; exercise: ComputersExerciseData }
  | { type: 'complete'; correct: number; total: number };

// ============================================================
// Sub-Components
// ============================================================

const LoadingView: React.FC = () => (
  <div style={styles.loadingContainer} role="status" aria-label="Loading exercise">
    <div style={styles.loadingSpinner} />
    <p style={styles.loadingText}>Loading computers exercise...</p>
  </div>
);

const ErrorView: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={styles.errorContainer} role="alert" aria-live="assertive">
    <div style={{ fontSize: '40px', marginBottom: '8px' }} aria-hidden="true">⚠️</div>
    <p style={styles.errorText}>{message}</p>
    <button style={styles.retryButton} onClick={onRetry} aria-label="Retry loading exercise">
      Try Again
    </button>
  </div>
);

const CompletionView: React.FC<{
  correct: number;
  total: number;
  onBack?: () => void;
}> = ({ correct, total, onBack }) => {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const icon = correct === total ? '🏆' : correct >= total / 2 ? '💻' : '📚';

  return (
    <div style={styles.summaryContainer} role="region" aria-label="Exercise completion summary">
      <div style={styles.summaryIcon} aria-hidden="true">{icon}</div>
      <h2 style={styles.summaryTitle}>Matching Exercise Complete!</h2>
      <div
        style={styles.summaryScore(correct, total)}
        aria-label={`Score: ${correct} out of ${total} correct`}
      >
        {correct}/{total}
      </div>
      <p style={styles.summaryMessage}>
        {correct === total
          ? 'Perfect! You matched all concepts correctly!'
          : correct >= total / 2
            ? 'Good job! Review the incorrect matches and try again.'
            : 'Keep practicing! Review the code concepts above.'}
        <br />
        You scored {percentage}% on this exercise.
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

export const ComputersExerciseScreen: React.FC<ComputersExerciseScreenProps> = ({
  fetchExercise,
  onValidateMatches,
  onBack,
  onComplete,
}) => {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'loading' });

  // Matching state
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  // userMatches: termId → definitionId (the pair id of the definition the user selected)
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<MatchValidationResult[] | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  // Shuffled definitions for display
  const [shuffledDefinitions, setShuffledDefinitions] = useState<MatchPair[]>([]);

  // Load exercise
  const loadExercise = useCallback(async () => {
    setScreenState({ type: 'loading' });
    try {
      const exercise = await fetchExercise();
      if (exercise.pairs.length < 3 || exercise.pairs.length > 8) {
        setScreenState({
          type: 'error',
          message: 'Invalid exercise: must have between 3 and 8 matching pairs.',
        });
        return;
      }
      setScreenState({ type: 'active', exercise });
      // Shuffle definitions
      const shuffled = [...exercise.pairs].sort(() => Math.random() - 0.5);
      setShuffledDefinitions(shuffled);
      resetState();
    } catch {
      setScreenState({
        type: 'error',
        message: 'Unable to load the exercise. Please check your connection and try again.',
      });
    }
  }, [fetchExercise]);

  useEffect(() => {
    loadExercise();
  }, [loadExercise]);

  const resetState = () => {
    setSelectedTerm(null);
    setSelectedDefinition(null);
    setUserMatches({});
    setValidationResults(null);
    setMessage(null);
    setIsValidating(false);
  };

  // Handle term selection (click-to-match approach simulating drag-and-drop)
  const handleTermClick = useCallback((termId: string) => {
    if (validationResults) return; // locked after validation
    if (userMatches[termId]) return; // already matched

    setSelectedTerm(termId);
    setMessage(null);

    // If a definition is already selected, make the match
    if (selectedDefinition) {
      setUserMatches((prev) => ({ ...prev, [termId]: selectedDefinition }));
      setSelectedTerm(null);
      setSelectedDefinition(null);
    }
  }, [validationResults, userMatches, selectedDefinition]);

  // Handle definition selection
  const handleDefinitionClick = useCallback((defId: string) => {
    if (validationResults) return; // locked after validation

    // Check if this definition is already matched
    const isAlreadyMatched = Object.values(userMatches).includes(defId);
    if (isAlreadyMatched) return;

    setSelectedDefinition(defId);
    setMessage(null);

    // If a term is already selected, make the match
    if (selectedTerm) {
      setUserMatches((prev) => ({ ...prev, [selectedTerm]: defId }));
      setSelectedTerm(null);
      setSelectedDefinition(null);
    }
  }, [validationResults, userMatches, selectedTerm]);

  // Handle Check Matches button (Req 16.3, 16.4, 16.5)
  const handleCheckMatches = useCallback(async () => {
    if (screenState.type !== 'active') return;
    const { exercise } = screenState;
    const totalPairs = exercise.pairs.length;
    const matchedCount = Object.keys(userMatches).length;

    // Req 16.3: If not all pairs matched, show remaining count
    if (matchedCount < totalPairs) {
      const remaining = totalPairs - matchedCount;
      setMessage({
        text: `${remaining} pair${remaining > 1 ? 's' : ''} remaining. Match all pairs before checking.`,
        type: 'info',
      });
      return;
    }

    // All matched → validate (Req 16.4)
    setIsValidating(true);
    setMessage(null);

    try {
      const results = await onValidateMatches(exercise.id, userMatches);
      setValidationResults(results);
      const correctCount = results.filter((r) => r.isCorrect).length;

      if (correctCount === totalPairs) {
        setMessage({ text: 'All matches correct!', type: 'success' });
      } else {
        setMessage({
          text: `${correctCount}/${totalPairs} correct. Incorrect matches shown in red.`,
          type: 'error',
        });
      }

      // Transition to completion after a brief delay
      setTimeout(() => {
        setScreenState({ type: 'complete', correct: correctCount, total: totalPairs });
        onComplete?.({ correct: correctCount, total: totalPairs });
      }, 2500);
    } catch {
      setMessage({ text: 'Unable to validate matches. Please try again.', type: 'error' });
    } finally {
      setIsValidating(false);
    }
  }, [screenState, userMatches, onValidateMatches, onComplete]);

  // Handle Reset button (Req 16.6)
  const handleReset = useCallback(() => {
    if (screenState.type !== 'active') return;
    resetState();
    // Re-shuffle definitions
    const shuffled = [...screenState.exercise.pairs].sort(() => Math.random() - 0.5);
    setShuffledDefinitions(shuffled);
  }, [screenState]);

  // Get validation state for a specific pair
  const getValidationState = (pairId: string): boolean | undefined => {
    if (!validationResults) return undefined;
    const result = validationResults.find((r) => r.pairId === pairId);
    return result?.isCorrect;
  };

  // ============================================================
  // Render
  // ============================================================

  if (screenState.type === 'loading') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}><LoadingView /></div>
      </>
    );
  }

  if (screenState.type === 'error') {
    return (
      <>
        <style>{ANIMATIONS_CSS}</style>
        <div style={styles.container}>
          <ErrorView message={screenState.message} onRetry={loadExercise} />
        </div>
      </>
    );
  }

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

  // Active state
  const { exercise } = screenState;

  return (
    <>
      <style>{ANIMATIONS_CSS}</style>
      <div style={styles.container} data-testid="computers-exercise-screen">
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.title}>💻 Code Matching</h1>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} aria-label="Back">
              ← Back
            </button>
          )}
        </header>

        {/* Code Editor Section (Req 16.1) */}
        <section
          style={styles.codeEditorCard}
          aria-label="Code editor with syntax highlighting"
          data-testid="code-editor-section"
        >
          <div style={styles.codeTitle}>
            {exercise.codeSnippet.title || exercise.codeSnippet.language}
          </div>
          <pre style={styles.codeContent}>
            {highlightCode(exercise.codeSnippet.code, exercise.codeSnippet.language)}
          </pre>
        </section>

        {/* Matching Section (Req 16.2) */}
        <section style={styles.matchingSection} aria-label="Drag and drop matching exercise">
          <h2 style={styles.sectionTitle}>
            Match the terms with their definitions ({exercise.pairs.length} pairs)
          </h2>

          <div style={styles.matchingGrid}>
            {/* Terms column */}
            <div style={styles.column}>
              <div style={styles.columnHeader}>Terms</div>
              {exercise.pairs.map((pair) => {
                const isSelected = selectedTerm === pair.id;
                const isMatched = !!userMatches[pair.id];
                const validState = getValidationState(pair.id);
                return (
                  <div
                    key={pair.id}
                    style={styles.termItem(isSelected || isMatched, validState)}
                    onClick={() => handleTermClick(pair.id)}
                    role="button"
                    aria-label={`Term: ${pair.term}${isMatched ? ' (matched)' : ''}`}
                    aria-pressed={isSelected}
                    data-testid={`term-${pair.id}`}
                  >
                    {pair.term}
                    {validState !== undefined && (
                      <span style={styles.validationIndicator(validState)}>
                        {validState ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Connector dots */}
            <div style={styles.connector}>
              {exercise.pairs.map((pair) => (
                <div
                  key={pair.id}
                  style={styles.connectorDot(!!userMatches[pair.id])}
                  aria-hidden="true"
                />
              ))}
            </div>

            {/* Definitions column (shuffled) */}
            <div style={styles.column}>
              <div style={styles.columnHeader}>Definitions</div>
              {shuffledDefinitions.map((pair) => {
                const isSelected = selectedDefinition === pair.id;
                const isMatched = Object.values(userMatches).includes(pair.id);
                // Find which term matched this definition for validation display
                const matchedTermId = Object.entries(userMatches).find(
                  ([, defId]) => defId === pair.id,
                )?.[0];
                const validState = matchedTermId ? getValidationState(matchedTermId) : undefined;
                return (
                  <div
                    key={pair.id}
                    style={styles.definitionItem(isSelected, isMatched, validState)}
                    onClick={() => handleDefinitionClick(pair.id)}
                    role="button"
                    aria-label={`Definition: ${pair.definition}${isMatched ? ' (matched)' : ''}`}
                    aria-pressed={isSelected}
                    data-testid={`definition-${pair.id}`}
                  >
                    {pair.definition}
                    {validState !== undefined && (
                      <span style={styles.validationIndicator(validState)}>
                        {validState ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message bar (Req 16.3, 16.5) */}
          {message && (
            <div
              style={styles.messageBar(message.type)}
              role={message.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              data-testid="message-bar"
            >
              {message.text}
            </div>
          )}

          {/* Action buttons */}
          <div style={styles.buttonRow}>
            <button
              style={styles.checkButton(isValidating || !!validationResults)}
              onClick={handleCheckMatches}
              disabled={isValidating || !!validationResults}
              aria-label="Check matches"
              data-testid="check-matches-button"
            >
              {isValidating ? 'Checking...' : 'Check Matches'}
            </button>
            <button
              style={styles.resetButton}
              onClick={handleReset}
              aria-label="Reset all matches"
              data-testid="reset-button"
            >
              Reset
            </button>
          </div>
        </section>
      </div>
    </>
  );
};

export default ComputersExerciseScreen;
