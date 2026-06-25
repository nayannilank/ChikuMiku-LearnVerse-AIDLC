/**
 * ChapterExplanationScreen — AI-generated chapter explanation with Read/Listen modes.
 *
 * Displays explanation content page by page with Summary, Key Words, Concepts sections.
 * Supports Read (text) and Listen (TTS audio) modes.
 * Provides revision question generation/viewing, summary generation/viewing, and translation.
 * Web: original text left, explanation right; Mobile: scrollable card.
 *
 * Validates: Requirements 10.1–10.16
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChapterExplanation, KeyWord, ChapterSummary } from '@learnverse/platform-contracts';

// ============================================================
// Types & Interfaces
// ============================================================

export type ViewMode = 'read' | 'listen';
export type TranslationLanguage = 'english' | 'hindi';

export interface ChapterExplanationScreenProps {
  /** Chapter ID for fetching explanation (from route params) */
  chapterId: string;
  /** Original page texts keyed by page number */
  originalTexts: Record<number, string>;
  /** Total number of pages in the chapter */
  totalPages: number;
  /** Fetch explanation for a given page (Req 10.1, 10.5, 10.6) */
  fetchExplanation: (chapterId: string, page: number) => Promise<{
    explanation: ChapterExplanation;
    cached: boolean;
    totalPages: number;
  }>;
  /** Generate TTS audio for current page (Req 10.4) */
  generateAudio: (chapterId: string) => Promise<{ audioUrl: string; s3Key: string }>;
  /** Generate revision questions (Req 10.10) */
  generateRevisionQuestions: (chapterId: string) => Promise<void>;
  /** Fetch stored revision questions (Req 10.12) */
  fetchRevisionQuestions: (chapterId: string) => Promise<{ questions: unknown[] } | null>;
  /** Generate chapter summary (Req 10.11) */
  generateSummary: (chapterId: string) => Promise<ChapterSummary>;
  /** Fetch stored chapter summary (Req 10.13) */
  fetchSummary: (chapterId: string) => Promise<ChapterSummary | null>;
  /** Translate explanation (Req 10.14, 10.15) */
  translateExplanation: (chapterId: string, targetLanguage: TranslationLanguage, page: number) => Promise<string>;
  /** Whether this is a language subject (Req 10.14) */
  isLanguageSubject?: boolean;
  /** Navigate to revision questions screen (Req 10.10) */
  onNavigateToRevision?: (chapterId: string) => void;
  /** Whether we are on a mobile viewport (Req 10.7, 10.8) */
  isMobile?: boolean;
}

// ============================================================
// Constants & Design Tokens
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  green: '#27AE60',
  muted: '#6B7280',
  lightPurple: '#F3E8FF',
} as const;

// ============================================================
// Exported Helpers
// ============================================================

/**
 * Determines the button label based on whether content already exists.
 * Exported for testing.
 */
export function getActionButtonLabel(
  type: 'revision' | 'summary',
  hasExistingContent: boolean,
): string {
  if (type === 'revision') {
    return hasExistingContent ? 'View Revision Questions' : 'Generate Revision Questions';
  }
  return hasExistingContent ? 'View Summary' : 'Generate Summary';
}

/**
 * Returns the display mode label.
 * Exported for testing.
 */
export function getModeLabel(mode: ViewMode): string {
  return mode === 'read' ? 'Read (Text)' : 'Listen (Speech)';
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
  } as React.CSSProperties,

  title: {
    fontSize: '26px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 20px 0',
  } as React.CSSProperties,

  // Mode toggle (Req 10.2)
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  } as React.CSSProperties,

  toggleButton: (isActive: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: isActive ? 'none' : `1px solid ${COLORS.border}`,
    borderRadius: '22px',
    backgroundColor: isActive ? COLORS.primary : COLORS.white,
    color: isActive ? COLORS.white : COLORS.dark,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),

  // Web layout: original left, explanation right (Req 10.7)
  webLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    alignItems: 'start',
  } as React.CSSProperties,

  // Mobile layout: scrollable card (Req 10.8)
  mobileLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  // Card panels
  panel: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '20px',
  } as React.CSSProperties,

  panelTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 12px 0',
  } as React.CSSProperties,

  sectionHeading: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.secondary,
    margin: '16px 0 8px 0',
  } as React.CSSProperties,

  bodyText: {
    fontSize: '13px',
    lineHeight: 1.7,
    color: COLORS.dark,
    margin: '0 0 8px 0',
    whiteSpace: 'pre-wrap' as const,
  } as React.CSSProperties,

  // Key words table (Req 10.3, 10.9)
  keyWordRow: {
    display: 'flex',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: COLORS.lightPurple,
    marginBottom: '6px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  keyWordLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.dark,
  } as React.CSSProperties,

  keyWordRomanization: {
    fontSize: '12px',
    fontStyle: 'italic' as const,
    color: COLORS.muted,
  } as React.CSSProperties,

  keyWordMeaning: {
    fontSize: '12px',
    color: COLORS.dark,
  } as React.CSSProperties,

  // Page navigation (Req 10.5)
  pageNav: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '24px',
    padding: '12px 0',
  } as React.CSSProperties,

  navButton: (disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '20px',
    backgroundColor: disabled ? COLORS.border : COLORS.secondary,
    color: disabled ? COLORS.muted : COLORS.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s',
  }),

  pageIndicator: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.dark,
  } as React.CSSProperties,

  // Action buttons row
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  actionButton: (isView: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: isView ? `1px solid ${COLORS.secondary}` : 'none',
    borderRadius: '22px',
    backgroundColor: isView ? COLORS.white : COLORS.primary,
    color: isView ? COLORS.secondary : COLORS.white,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),

  // Translation selector (Req 10.14)
  translationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  } as React.CSSProperties,

  translationLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.muted,
  } as React.CSSProperties,

  translationSelect: {
    padding: '6px 12px',
    fontSize: '12px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Audio player (Req 10.4)
  audioPlayer: {
    width: '100%',
    marginTop: '12px',
  } as React.CSSProperties,

  // Loading/Error
  loadingText: {
    fontSize: '13px',
    color: COLORS.muted,
    padding: '20px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  errorText: {
    fontSize: '12px',
    color: COLORS.error,
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: '#FDF2F2',
    marginBottom: '12px',
  } as React.CSSProperties,

  // Summary display
  summaryPanel: {
    backgroundColor: COLORS.lightPurple,
    borderRadius: '12px',
    padding: '16px',
    marginTop: '12px',
  } as React.CSSProperties,

  summaryList: {
    listStyle: 'disc',
    paddingLeft: '20px',
    margin: '8px 0',
    fontSize: '13px',
    lineHeight: 1.6,
    color: COLORS.dark,
  } as React.CSSProperties,
} as const;

// ============================================================
// Main Component
// ============================================================

export const ChapterExplanationScreen: React.FC<ChapterExplanationScreenProps> = ({
  chapterId,
  originalTexts,
  totalPages,
  fetchExplanation,
  generateAudio,
  generateRevisionQuestions,
  fetchRevisionQuestions,
  generateSummary,
  fetchSummary,
  translateExplanation,
  isLanguageSubject = false,
  onNavigateToRevision,
  isMobile = false,
}) => {
  // Page state (Req 10.5, 10.6)
  const [currentPage, setCurrentPage] = useState(1);
  const [explanation, setExplanation] = useState<ChapterExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode state (Req 10.2)
  const [mode, setMode] = useState<ViewMode>('read');

  // Audio state (Req 10.4)
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Revision questions state (Req 10.10, 10.12)
  const [hasRevisionQuestions, setHasRevisionQuestions] = useState(false);
  const [isGeneratingRevision, setIsGeneratingRevision] = useState(false);

  // Summary state (Req 10.11, 10.13)
  const [hasSummary, setHasSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<ChapterSummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Translation state (Req 10.14, 10.15, 10.16)
  const [selectedLanguage, setSelectedLanguage] = useState<TranslationLanguage | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // === Effects ===

  // Load explanation for current page
  useEffect(() => {
    let cancelled = false;

    const loadExplanation = async () => {
      setIsLoading(true);
      setError(null);
      setAudioUrl(null);
      setTranslatedText(null);

      try {
        const result = await fetchExplanation(chapterId, currentPage);
        if (!cancelled) {
          setExplanation(result.explanation);
          // If audio already exists from CDN, set it
          if (result.explanation.audioCdnUrl) {
            setAudioUrl(result.explanation.audioCdnUrl);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load explanation. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadExplanation();
    return () => { cancelled = true; };
  }, [chapterId, currentPage, fetchExplanation]);

  // Check for existing revision questions and summary on mount
  useEffect(() => {
    let cancelled = false;

    const checkExistingContent = async () => {
      try {
        const [revResult, sumResult] = await Promise.allSettled([
          fetchRevisionQuestions(chapterId),
          fetchSummary(chapterId),
        ]);

        if (!cancelled) {
          if (revResult.status === 'fulfilled' && revResult.value) {
            setHasRevisionQuestions(true);
          }
          if (sumResult.status === 'fulfilled' && sumResult.value) {
            setHasSummary(true);
            setSummaryData(sumResult.value);
          }
        }
      } catch {
        // Non-critical — buttons will default to "Generate" state
      }
    };

    checkExistingContent();
    return () => { cancelled = true; };
  }, [chapterId, fetchRevisionQuestions, fetchSummary]);

  // === Handlers ===

  const handlePageChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentPage((prev) => {
      if (direction === 'prev' && prev > 1) return prev - 1;
      if (direction === 'next' && prev < totalPages) return prev + 1;
      return prev;
    });
  }, [totalPages]);

  const handleModeToggle = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    // Generate audio when switching to listen mode if not available
    if (newMode === 'listen' && !audioUrl && !isGeneratingAudio) {
      setIsGeneratingAudio(true);
      generateAudio(chapterId)
        .then((result) => {
          setAudioUrl(result.audioUrl);
        })
        .catch(() => {
          setError('Failed to generate audio. Please try again.');
        })
        .finally(() => {
          setIsGeneratingAudio(false);
        });
    }
  }, [audioUrl, isGeneratingAudio, generateAudio, chapterId]);

  const handleRevisionAction = useCallback(async () => {
    if (hasRevisionQuestions) {
      // Navigate to revision screen (Req 10.12)
      onNavigateToRevision?.(chapterId);
      return;
    }

    // Generate revision questions (Req 10.10)
    setIsGeneratingRevision(true);
    try {
      await generateRevisionQuestions(chapterId);
      setHasRevisionQuestions(true);
      onNavigateToRevision?.(chapterId);
    } catch {
      setError('Failed to generate revision questions. Please try again.');
    } finally {
      setIsGeneratingRevision(false);
    }
  }, [hasRevisionQuestions, chapterId, generateRevisionQuestions, onNavigateToRevision]);

  const handleSummaryAction = useCallback(async () => {
    if (hasSummary && summaryData) {
      // Toggle summary display (Req 10.13)
      setShowSummary((prev) => !prev);
      return;
    }

    // Generate summary (Req 10.11)
    setIsGeneratingSummary(true);
    try {
      const result = await generateSummary(chapterId);
      setSummaryData(result);
      setHasSummary(true);
      setShowSummary(true);
    } catch {
      setError('Failed to generate summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [hasSummary, summaryData, chapterId, generateSummary]);

  const handleTranslationChange = useCallback(async (language: TranslationLanguage) => {
    setSelectedLanguage(language);
    setIsTranslating(true);
    setTranslatedText(null);

    try {
      const result = await translateExplanation(chapterId, language, currentPage);
      setTranslatedText(result);
    } catch {
      setError('Failed to translate content. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  }, [chapterId, currentPage, translateExplanation]);

  // === Render Helpers ===

  const renderModeToggle = () => (
    <div style={styles.toggleRow} role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'read'}
        style={styles.toggleButton(mode === 'read')}
        onClick={() => handleModeToggle('read')}
      >
        {getModeLabel('read')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'listen'}
        style={styles.toggleButton(mode === 'listen')}
        onClick={() => handleModeToggle('listen')}
      >
        {getModeLabel('listen')}
      </button>
    </div>
  );

  const renderActionButtons = () => (
    <div style={styles.actionsRow}>
      <button
        type="button"
        style={styles.actionButton(hasRevisionQuestions)}
        onClick={handleRevisionAction}
        disabled={isGeneratingRevision}
        aria-busy={isGeneratingRevision}
        aria-label={getActionButtonLabel('revision', hasRevisionQuestions)}
      >
        {isGeneratingRevision
          ? 'Generating...'
          : getActionButtonLabel('revision', hasRevisionQuestions)}
      </button>
      <button
        type="button"
        style={styles.actionButton(hasSummary)}
        onClick={handleSummaryAction}
        disabled={isGeneratingSummary}
        aria-busy={isGeneratingSummary}
        aria-label={getActionButtonLabel('summary', hasSummary)}
      >
        {isGeneratingSummary
          ? 'Generating...'
          : getActionButtonLabel('summary', hasSummary)}
      </button>
    </div>
  );

  const renderTranslationSelector = () => {
    if (!isLanguageSubject) return null;

    return (
      <div style={styles.translationRow}>
        <span style={styles.translationLabel}>Translate to:</span>
        <select
          style={styles.translationSelect}
          value={selectedLanguage ?? ''}
          onChange={(e) => {
            const val = e.target.value as TranslationLanguage;
            if (val) handleTranslationChange(val);
          }}
          aria-label="Translation language selector"
        >
          <option value="">Select language</option>
          <option value="english">English</option>
          <option value="hindi">Hindi</option>
        </select>
        {isTranslating && <span style={styles.loadingText}>Translating...</span>}
      </div>
    );
  };

  const renderKeyWords = (keyWords: KeyWord[]) => (
    <div role="list" aria-label="Key words">
      {keyWords.map((kw, idx) => (
        <div key={idx} style={styles.keyWordRow} role="listitem">
          <span style={styles.keyWordLabel}>{kw.word}</span>
          {kw.romanization && (
            <span style={styles.keyWordRomanization}>({kw.romanization})</span>
          )}
          <span style={styles.keyWordMeaning}>— {kw.meaning}</span>
        </div>
      ))}
    </div>
  );

  const renderReadMode = () => {
    if (!explanation) return null;

    return (
      <div>
        {/* Summary section (Req 10.3) */}
        <h3 style={styles.sectionHeading}>Summary</h3>
        <p style={styles.bodyText}>{explanation.summary}</p>

        {/* Key Words section (Req 10.3, 10.9) */}
        {explanation.keyWords.length > 0 && (
          <>
            <h3 style={styles.sectionHeading}>Key Words</h3>
            {renderKeyWords(explanation.keyWords)}
          </>
        )}

        {/* Concepts section (Req 10.3) */}
        <h3 style={styles.sectionHeading}>Concepts</h3>
        <p style={styles.bodyText}>{explanation.concepts}</p>

        {/* Translated text (Req 10.15) */}
        {translatedText && (
          <>
            <h3 style={styles.sectionHeading}>
              Translation ({selectedLanguage === 'english' ? 'English' : 'Hindi'})
            </h3>
            <p style={styles.bodyText}>{translatedText}</p>
          </>
        )}
      </div>
    );
  };

  const renderListenMode = () => (
    <div>
      {isGeneratingAudio && (
        <p style={styles.loadingText}>Generating audio narration...</p>
      )}
      {audioUrl && (
        <audio
          ref={audioRef}
          controls
          src={audioUrl}
          style={styles.audioPlayer}
          aria-label="Chapter explanation audio"
        >
          Your browser does not support the audio element.
        </audio>
      )}
      {/* Also show text content below audio for reference */}
      {explanation && (
        <>
          <h3 style={styles.sectionHeading}>Summary</h3>
          <p style={styles.bodyText}>{explanation.summary}</p>
        </>
      )}
    </div>
  );

  const renderPageNavigation = () => (
    <nav style={styles.pageNav} aria-label="Page navigation">
      <button
        type="button"
        style={styles.navButton(currentPage <= 1)}
        onClick={() => handlePageChange('prev')}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        ← Previous
      </button>
      <span style={styles.pageIndicator} aria-live="polite" aria-atomic="true">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        style={styles.navButton(currentPage >= totalPages)}
        onClick={() => handlePageChange('next')}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );

  const renderSummaryPanel = () => {
    if (!showSummary || !summaryData) return null;

    return (
      <div style={styles.summaryPanel} role="region" aria-label="Chapter summary">
        <h3 style={styles.sectionHeading}>Chapter Summary</h3>

        <h4 style={{ ...styles.sectionHeading, fontSize: '13px' }}>Key Points</h4>
        <ul style={styles.summaryList}>
          {summaryData.keyPoints.map((point, idx) => (
            <li key={idx}>{point}</li>
          ))}
        </ul>

        <h4 style={{ ...styles.sectionHeading, fontSize: '13px' }}>Important Concepts</h4>
        <ul style={styles.summaryList}>
          {summaryData.importantConcepts.map((concept, idx) => (
            <li key={idx}>{concept}</li>
          ))}
        </ul>

        <h4 style={{ ...styles.sectionHeading, fontSize: '13px' }}>Exam Preparation Notes</h4>
        <ul style={styles.summaryList}>
          {summaryData.examPreparationNotes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderOriginalTextPanel = () => (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>Original Text</h2>
      <p style={styles.bodyText}>
        {originalTexts[currentPage] ?? 'No original text available for this page.'}
      </p>
    </div>
  );

  const renderExplanationPanel = () => (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>Explanation</h2>
      {renderTranslationSelector()}
      {isLoading ? (
        <p style={styles.loadingText}>Loading explanation...</p>
      ) : mode === 'read' ? (
        renderReadMode()
      ) : (
        renderListenMode()
      )}
    </div>
  );

  // === Mobile Layout (Req 10.8) ===
  if (isMobile) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Chapter Explanation</h1>
        {renderModeToggle()}
        {renderActionButtons()}

        {error && (
          <p style={styles.errorText} role="alert" aria-live="assertive">{error}</p>
        )}

        <div style={styles.mobileLayout}>
          <div style={styles.panel}>
            {renderTranslationSelector()}
            {isLoading ? (
              <p style={styles.loadingText}>Loading explanation...</p>
            ) : mode === 'read' ? (
              renderReadMode()
            ) : (
              renderListenMode()
            )}
          </div>
        </div>

        {renderSummaryPanel()}
        {renderPageNavigation()}
      </div>
    );
  }

  // === Web Layout (Req 10.7) ===
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Chapter Explanation</h1>
      {renderModeToggle()}
      {renderActionButtons()}

      {error && (
        <p style={styles.errorText} role="alert" aria-live="assertive">{error}</p>
      )}

      <div style={styles.webLayout}>
        {/* Left: Original text (Req 10.7) */}
        {renderOriginalTextPanel()}

        {/* Right: Explanation (Req 10.7) */}
        {renderExplanationPanel()}
      </div>

      {renderSummaryPanel()}
      {renderPageNavigation()}
    </div>
  );
};

export default ChapterExplanationScreen;
