/**
 * ChapterTranscript — Displays extracted text organized page by page.
 *
 * Shows page number, word count, and extracted text for each page.
 * Displays total pages processed + total word count summary.
 * Provides "Edit Transcript" button for manual corrections and "Save Transcript" button.
 * Web: image thumbnails left, text right; Mobile: scrollable page text blocks.
 *
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */

import React, { useState, useCallback } from 'react';
import type { ChapterPage } from '@learnverse/platform-contracts';

// ============================================================
// Types & Interfaces
// ============================================================

export interface ChapterTranscriptProps {
  /** Pages data with extracted text (Req 9.2, 9.3) */
  pages: ChapterPage[];
  /** Callback to persist transcript content (Req 9.6) */
  onSaveTranscript: (pages: { pageNumber: number; extractedText: string }[]) => Promise<void>;
  /** Map of page number → image URL for thumbnails (Req 9.7) */
  imageUrls?: Record<number, string>;
  /** Whether we are on a mobile viewport (Req 9.7, 9.8) */
  isMobile?: boolean;
}

// ============================================================
// Exported Helpers
// ============================================================

/**
 * Counts whitespace-separated tokens in text.
 * Exported for use in property tests (Property 12).
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// ============================================================
// Constants & Design Tokens
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  green: '#27AE60',
  muted: '#6B7280',
  selectedBg: '#F3E8FF',
  selectedBorder: '#9B59B6',
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
  } as React.CSSProperties,

  heading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  // Summary line (Req 9.4)
  summary: {
    fontSize: '13px',
    color: COLORS.muted,
    margin: '0 0 20px 0',
  } as React.CSSProperties,

  // Actions row
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  editButton: (isEditing: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: isEditing ? `2px solid ${COLORS.primary}` : 'none',
    borderRadius: '22px',
    backgroundColor: isEditing ? COLORS.white : COLORS.primary,
    color: isEditing ? COLORS.primary : COLORS.white,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),

  saveButton: (disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.green,
    color: COLORS.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
  }),

  // Web layout: thumbnails left, text right (Req 9.7)
  webLayout: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    gap: '24px',
    alignItems: 'start',
  } as React.CSSProperties,

  // Mobile layout: single column scrollable (Req 9.8)
  mobileLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  // Thumbnail sidebar (Req 9.7)
  thumbnailSidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    position: 'sticky' as const,
    top: '24px',
  } as React.CSSProperties,

  thumbnailCard: (isSelected: boolean): React.CSSProperties => ({
    borderRadius: '10px',
    overflow: 'hidden',
    border: isSelected ? `2px solid ${COLORS.selectedBorder}` : `1px solid ${COLORS.border}`,
    backgroundColor: isSelected ? COLORS.selectedBg : COLORS.white,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: isSelected ? '0 2px 12px rgba(155, 89, 182, 0.15)' : 'none',
  }),

  thumbnailImage: {
    width: '100%',
    height: '100px',
    objectFit: 'cover' as const,
    display: 'block',
  } as React.CSSProperties,

  thumbnailLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
    padding: '6px 8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  thumbnailPlaceholder: {
    width: '100%',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    fontSize: '24px',
  } as React.CSSProperties,

  // Text content area
  textContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  // Page text block (Req 9.3)
  pageBlock: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '20px',
  } as React.CSSProperties,

  pageBlockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,

  pageNumber: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  wordCount: {
    fontSize: '12px',
    fontWeight: 500,
    color: COLORS.muted,
    margin: 0,
  } as React.CSSProperties,

  pageText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: COLORS.dark,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  } as React.CSSProperties,

  // Editable textarea (Req 9.5)
  pageTextarea: {
    width: '100%',
    minHeight: '120px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: COLORS.dark,
    padding: '12px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  // Error message
  errorMessage: {
    fontSize: '12px',
    color: COLORS.error,
    backgroundColor: '#FDF2F2',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,

  // OCR failed indicator (Req 9.10 partial)
  ocrFailed: {
    fontSize: '12px',
    color: COLORS.error,
    fontStyle: 'italic' as const,
  } as React.CSSProperties,

  // Empty state
  emptyText: {
    fontSize: '13px',
    color: COLORS.muted,
    textAlign: 'center' as const,
    padding: '40px 20px',
  } as React.CSSProperties,
} as const;

// ============================================================
// Main Component
// ============================================================

export const ChapterTranscript: React.FC<ChapterTranscriptProps> = ({
  pages,
  onSaveTranscript,
  imageUrls = {},
  isMobile = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>(
    pages.length > 0 ? pages[0].pageNumber : 1
  );

  // Sort pages by page number
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Compute word counts per page and total (Req 9.3, 9.4)
  const getPageText = (page: ChapterPage): string => {
    if (editedTexts[page.pageNumber] !== undefined) {
      return editedTexts[page.pageNumber];
    }
    return page.extractedText ?? '';
  };

  const totalPages = sortedPages.filter((p) => p.ocrStatus === 'completed').length;
  const totalWordCount = sortedPages.reduce((sum, page) => {
    if (page.ocrStatus !== 'completed') return sum;
    return sum + countWords(getPageText(page));
  }, 0);

  // === Handlers ===

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Exiting edit mode — discard changes
      setEditedTexts({});
    }
    setIsEditing((prev) => !prev);
  }, [isEditing]);

  const handleTextChange = useCallback((pageNumber: number, text: string) => {
    setEditedTexts((prev) => ({ ...prev, [pageNumber]: text }));
  }, []);

  const handleSaveTranscript = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const transcriptData = sortedPages
        .filter((p) => p.ocrStatus === 'completed')
        .map((page) => ({
          pageNumber: page.pageNumber,
          extractedText: getPageText(page),
        }));

      await onSaveTranscript(transcriptData);
      setIsEditing(false);
      setEditedTexts({});
    } catch {
      setSaveError('Failed to save transcript. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, sortedPages, onSaveTranscript, editedTexts]);

  const handleThumbnailClick = useCallback((pageNumber: number) => {
    setSelectedPageNumber(pageNumber);
    // Scroll to the page block
    const element = document.getElementById(`page-block-${pageNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // === Render Helpers ===

  const renderSummary = () => (
    <p style={styles.summary} aria-label="Transcript summary">
      Text extracted from {totalPages} {totalPages === 1 ? 'page' : 'pages'} • Total:{' '}
      {totalWordCount.toLocaleString()} {totalWordCount === 1 ? 'word' : 'words'}
    </p>
  );

  const renderActions = () => (
    <div style={styles.actionsRow}>
      <button
        type="button"
        style={styles.editButton(isEditing)}
        onClick={handleEditToggle}
        aria-label={isEditing ? 'Cancel editing' : 'Edit Transcript'}
        aria-pressed={isEditing}
      >
        {isEditing ? 'Cancel Edit' : 'Edit Transcript'}
      </button>
      <button
        type="button"
        style={styles.saveButton(isSaving || sortedPages.length === 0)}
        onClick={handleSaveTranscript}
        disabled={isSaving || sortedPages.length === 0}
        aria-busy={isSaving}
        aria-label="Save Transcript"
      >
        {isSaving ? 'Saving...' : 'Save Transcript'}
      </button>
    </div>
  );

  const renderPageBlock = (page: ChapterPage) => {
    const text = getPageText(page);
    const pageWordCount = countWords(text);
    const isFailed = page.ocrStatus === 'failed';

    return (
      <div
        key={page.id}
        id={`page-block-${page.pageNumber}`}
        style={styles.pageBlock}
        role="article"
        aria-label={`Page ${page.pageNumber}`}
      >
        <div style={styles.pageBlockHeader}>
          <h3 style={styles.pageNumber}>Page {page.pageNumber}</h3>
          {!isFailed && (
            <span style={styles.wordCount}>
              {pageWordCount.toLocaleString()} {pageWordCount === 1 ? 'word' : 'words'}
            </span>
          )}
        </div>

        {isFailed ? (
          <p style={styles.ocrFailed}>Text extraction failed for this page</p>
        ) : isEditing ? (
          <textarea
            style={styles.pageTextarea}
            value={text}
            onChange={(e) => handleTextChange(page.pageNumber, e.target.value)}
            aria-label={`Edit text for page ${page.pageNumber}`}
          />
        ) : (
          <p style={styles.pageText}>{text || 'No text extracted'}</p>
        )}
      </div>
    );
  };

  const renderThumbnailSidebar = () => (
    <div style={styles.thumbnailSidebar} role="list" aria-label="Page thumbnails">
      {sortedPages.map((page) => {
        const imageUrl = imageUrls[page.pageNumber];
        const isSelected = page.pageNumber === selectedPageNumber;

        return (
          <div
            key={page.id}
            role="listitem"
            style={styles.thumbnailCard(isSelected)}
            onClick={() => handleThumbnailClick(page.pageNumber)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleThumbnailClick(page.pageNumber);
              }
            }}
            tabIndex={0}
            aria-label={`Page ${page.pageNumber} thumbnail${isSelected ? ' (selected)' : ''}`}
            aria-pressed={isSelected}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`Page ${page.pageNumber}`}
                style={styles.thumbnailImage}
              />
            ) : (
              <div style={styles.thumbnailPlaceholder}>📄</div>
            )}
            <div style={styles.thumbnailLabel}>Page {page.pageNumber}</div>
          </div>
        );
      })}
    </div>
  );

  // === Empty State ===

  if (pages.length === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Chapter Transcript</h1>
        <p style={styles.emptyText}>No pages available. Upload pages first.</p>
      </div>
    );
  }

  // === Mobile Layout (Req 9.8) ===

  if (isMobile) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Chapter Transcript</h1>
        {renderSummary()}
        {renderActions()}

        {saveError && (
          <p style={styles.errorMessage} role="alert" aria-live="assertive">
            {saveError}
          </p>
        )}

        <div style={styles.mobileLayout} role="region" aria-label="Transcript pages">
          {sortedPages.map(renderPageBlock)}
        </div>
      </div>
    );
  }

  // === Web Layout (Req 9.7) ===

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Chapter Transcript</h1>
      {renderSummary()}
      {renderActions()}

      {saveError && (
        <p style={styles.errorMessage} role="alert" aria-live="assertive">
          {saveError}
        </p>
      )}

      <div style={styles.webLayout}>
        {/* Left: Page image thumbnails (Req 9.7) */}
        {renderThumbnailSidebar()}

        {/* Right: Text content (Req 9.7) */}
        <div style={styles.textContent} role="region" aria-label="Transcript pages">
          {sortedPages.map(renderPageBlock)}
        </div>
      </div>
    </div>
  );
};

export default ChapterTranscript;
