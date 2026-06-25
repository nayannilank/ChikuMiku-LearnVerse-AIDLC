/**
 * ContentIngestionScreen — Subject/Book/Chapter selection UI for content ingestion.
 *
 * Displays only assigned subjects; books with name + chapter count; chapters with status.
 * Provides "Add New Book" and "Add New Chapter" dialogs (name 1-200 chars).
 * Web: sidebar + main content side by side; Mobile: step-by-step flow.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import React, { useState, useCallback } from 'react';
import type { SubjectAssignment, Book, Chapter } from '@learnverse/platform-contracts';

// ============================================================
// Types & Interfaces
// ============================================================

export interface ContentIngestionProps {
  /** Subjects assigned to the authenticated student (Req 7.1) */
  subjects: SubjectAssignment[];
  /** Fetch books for a given subject ID (Req 7.2) */
  fetchBooks: (subjectId: string) => Promise<Book[]>;
  /** Create a new book under a subject (Req 7.3) */
  createBook: (subjectId: string, name: string) => Promise<Book>;
  /** Fetch chapters for a given book ID (Req 7.4) */
  fetchChapters: (bookId: string) => Promise<Chapter[]>;
  /** Create a new chapter under a book (Req 7.5) */
  createChapter: (bookId: string, name: string) => Promise<Chapter>;
  /** Navigate to Page Upload UI for a chapter (Req 7.6) */
  onChapterSelect: (chapterId: string) => void;
  /** Whether we are on a mobile viewport (Req 7.7, 7.8) */
  isMobile?: boolean;
}

interface DialogState {
  type: 'book' | 'chapter' | null;
  name: string;
  error: string | null;
  isSaving: boolean;
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
  errorBg: '#FDF2F2',
  green: '#27AE60',
  muted: '#6B7280',
  gold: '#F7C948',
} as const;

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 200;

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
    margin: '0 0 20px 0',
  } as React.CSSProperties,

  // Web layout: sidebar + main (Req 7.7)
  webLayout: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    gap: '24px',
    alignItems: 'start',
  } as React.CSSProperties,

  // Mobile layout: single column (Req 7.8)
  mobileLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  // Subject sidebar/list
  subjectList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  subjectItem: (color: string, isActive: boolean): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: isActive ? `${color}15` : COLORS.white,
    border: isActive ? `2px solid ${color}` : `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.15s ease',
  }),

  subjectDot: (color: string): React.CSSProperties => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  }),

  subjectName: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  // Main content area
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  } as React.CSSProperties,

  // Books and chapters panels (side by side on web)
  panelsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    alignItems: 'start',
  } as React.CSSProperties,

  panelsSingle: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  panel: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '20px',
  } as React.CSSProperties,

  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,

  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  addButton: {
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '20px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  // Book item (Req 7.2)
  bookItem: (isActive: boolean): React.CSSProperties => ({
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: isActive ? '#F3E8FF' : COLORS.background,
    border: isActive ? `1px solid ${COLORS.secondary}` : '1px solid transparent',
    cursor: 'pointer',
    marginBottom: '8px',
    transition: 'all 0.15s ease',
  }),

  bookName: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.dark,
    margin: '0 0 4px 0',
  } as React.CSSProperties,

  bookMeta: {
    fontSize: '11px',
    color: COLORS.muted,
    margin: 0,
  } as React.CSSProperties,

  // Chapter item (Req 7.4)
  chapterItem: {
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: COLORS.background,
    cursor: 'pointer',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.15s ease',
  } as React.CSSProperties,

  chapterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  } as React.CSSProperties,

  chapterSeq: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: COLORS.secondary,
    color: COLORS.white,
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  chapterName: {
    fontSize: '13px',
    fontWeight: 500,
    color: COLORS.dark,
  } as React.CSSProperties,

  chapterStatus: (hasContent: boolean): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '10px',
    backgroundColor: hasContent ? '#E8F8F0' : '#FFF3E0',
    color: hasContent ? COLORS.green : '#E67E22',
  }),

  // Mobile step navigation (Req 7.8)
  mobileBackBtn: {
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '20px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    cursor: 'pointer',
    marginBottom: '12px',
  } as React.CSSProperties,

  // Dialog styles (Req 7.3, 7.5)
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  } as React.CSSProperties,

  dialog: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    padding: '28px 24px',
    width: '100%',
    maxWidth: '400px',
  } as React.CSSProperties,

  dialogTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 16px 0',
  } as React.CSSProperties,

  dialogInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '13px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '8px',
  } as React.CSSProperties,

  dialogCharCount: (isOver: boolean): React.CSSProperties => ({
    fontSize: '11px',
    color: isOver ? COLORS.error : COLORS.muted,
    margin: '0 0 12px 0',
    textAlign: 'right' as const,
  }),

  dialogError: {
    fontSize: '11px',
    color: COLORS.error,
    margin: '0 0 12px 0',
  } as React.CSSProperties,

  dialogButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  } as React.CSSProperties,

  dialogCancelBtn: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '20px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  dialogSaveBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '20px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }),

  // Empty state
  emptyText: {
    fontSize: '13px',
    color: COLORS.muted,
    textAlign: 'center' as const,
    padding: '20px',
  } as React.CSSProperties,

  // Loading state
  loadingText: {
    fontSize: '13px',
    color: COLORS.muted,
    padding: '16px',
  } as React.CSSProperties,
} as const;

// ============================================================
// Validation Helper
// ============================================================

/**
 * Validates a book or chapter name.
 * Returns an error string if invalid, null if valid.
 */
export function validateContentName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN_LENGTH) {
    return 'Name is required (1-200 characters)';
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `Name must not exceed ${NAME_MAX_LENGTH} characters`;
  }
  return null;
}

// ============================================================
// Main Component
// ============================================================

export const ContentIngestionScreen: React.FC<ContentIngestionProps> = ({
  subjects,
  fetchBooks,
  createBook,
  fetchChapters,
  createChapter,
  onChapterSelect,
  isMobile = false,
}) => {
  // Selection state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Data state
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // Mobile step state (Req 7.8)
  const [mobileStep, setMobileStep] = useState<'subjects' | 'books' | 'chapters'>('subjects');

  // Dialog state (Req 7.3, 7.5)
  const [dialog, setDialog] = useState<DialogState>({
    type: null,
    name: '',
    error: null,
    isSaving: false,
  });

  // === Handlers ===

  const handleSubjectSelect = useCallback(async (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedBookId(null);
    setChapters([]);
    setBooksLoading(true);
    if (isMobile) setMobileStep('books');

    try {
      const fetchedBooks = await fetchBooks(subjectId);
      setBooks(fetchedBooks);
    } catch {
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  }, [fetchBooks, isMobile]);

  const handleBookSelect = useCallback(async (bookId: string) => {
    setSelectedBookId(bookId);
    setChaptersLoading(true);
    if (isMobile) setMobileStep('chapters');

    try {
      const fetchedChapters = await fetchChapters(bookId);
      setChapters(fetchedChapters);
    } catch {
      setChapters([]);
    } finally {
      setChaptersLoading(false);
    }
  }, [fetchChapters, isMobile]);

  const handleChapterSelect = useCallback((chapterId: string) => {
    onChapterSelect(chapterId);
  }, [onChapterSelect]);

  // Dialog handlers
  const openAddBookDialog = useCallback(() => {
    setDialog({ type: 'book', name: '', error: null, isSaving: false });
  }, []);

  const openAddChapterDialog = useCallback(() => {
    setDialog({ type: 'chapter', name: '', error: null, isSaving: false });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ type: null, name: '', error: null, isSaving: false });
  }, []);

  const handleDialogNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDialog((prev) => ({ ...prev, name: e.target.value, error: null }));
  }, []);

  const handleDialogSave = useCallback(async () => {
    const validationError = validateContentName(dialog.name);
    if (validationError) {
      setDialog((prev) => ({ ...prev, error: validationError }));
      return;
    }

    setDialog((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      if (dialog.type === 'book' && selectedSubjectId) {
        const newBook = await createBook(selectedSubjectId, dialog.name.trim());
        setBooks((prev) => [...prev, newBook]);
      } else if (dialog.type === 'chapter' && selectedBookId) {
        const newChapter = await createChapter(selectedBookId, dialog.name.trim());
        setChapters((prev) => [...prev, newChapter]);
      }
      closeDialog();
    } catch {
      setDialog((prev) => ({
        ...prev,
        isSaving: false,
        error: 'Failed to save. Please try again.',
      }));
    }
  }, [dialog.name, dialog.type, selectedSubjectId, selectedBookId, createBook, createChapter, closeDialog]);

  // Mobile back navigation
  const handleMobileBack = useCallback(() => {
    if (mobileStep === 'chapters') {
      setMobileStep('books');
      setSelectedBookId(null);
      setChapters([]);
    } else if (mobileStep === 'books') {
      setMobileStep('subjects');
      setSelectedSubjectId(null);
      setBooks([]);
    }
  }, [mobileStep]);

  // === Render helpers ===

  const selectedSubject = subjects.find((s) => s.subjectId === selectedSubjectId);

  const renderSubjectList = () => (
    <div style={styles.subjectList} role="list" aria-label="Assigned subjects">
      {subjects.map((subject) => (
        <div
          key={subject.subjectId}
          role="listitem"
          style={styles.subjectItem(subject.color, subject.subjectId === selectedSubjectId)}
          onClick={() => handleSubjectSelect(subject.subjectId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSubjectSelect(subject.subjectId);
            }
          }}
          tabIndex={0}
          aria-label={`Select ${subject.subjectName}`}
          aria-pressed={subject.subjectId === selectedSubjectId}
        >
          <div style={styles.subjectDot(subject.color)} />
          <span style={styles.subjectName}>{subject.subjectName}</span>
        </div>
      ))}
    </div>
  );

  const renderBookList = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>
          Books{selectedSubject ? ` — ${selectedSubject.subjectName}` : ''}
        </h3>
        {selectedSubjectId && (
          <button
            type="button"
            style={styles.addButton}
            onClick={openAddBookDialog}
            aria-label="Add New Book"
          >
            + Add New Book
          </button>
        )}
      </div>

      {!selectedSubjectId ? (
        <p style={styles.emptyText}>Select a subject to view books</p>
      ) : booksLoading ? (
        <p style={styles.loadingText}>Loading books...</p>
      ) : books.length === 0 ? (
        <p style={styles.emptyText}>No books yet. Add your first book!</p>
      ) : (
        <div role="list" aria-label="Books">
          {books.map((book) => (
            <div
              key={book.id}
              role="listitem"
              style={styles.bookItem(book.id === selectedBookId)}
              onClick={() => handleBookSelect(book.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBookSelect(book.id);
                }
              }}
              tabIndex={0}
              aria-label={`${book.name}, ${book.chapterCount} chapters`}
              aria-pressed={book.id === selectedBookId}
            >
              <p style={styles.bookName}>{book.name}</p>
              <p style={styles.bookMeta}>
                {book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderChapterList = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>Chapters</h3>
        {selectedBookId && (
          <button
            type="button"
            style={styles.addButton}
            onClick={openAddChapterDialog}
            aria-label="Add New Chapter"
          >
            + Add New Chapter
          </button>
        )}
      </div>

      {!selectedBookId ? (
        <p style={styles.emptyText}>Select a book to view chapters</p>
      ) : chaptersLoading ? (
        <p style={styles.loadingText}>Loading chapters...</p>
      ) : chapters.length === 0 ? (
        <p style={styles.emptyText}>No chapters yet. Add your first chapter!</p>
      ) : (
        <div role="list" aria-label="Chapters">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              role="listitem"
              style={styles.chapterItem}
              onClick={() => handleChapterSelect(chapter.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleChapterSelect(chapter.id);
                }
              }}
              tabIndex={0}
              aria-label={`Chapter ${chapter.sequenceNumber}: ${chapter.name}, ${chapter.hasContent ? 'has content' : 'new'}`}
            >
              <div style={styles.chapterLeft}>
                <div style={styles.chapterSeq}>{chapter.sequenceNumber}</div>
                <span style={styles.chapterName}>{chapter.name}</span>
              </div>
              <span style={styles.chapterStatus(chapter.hasContent)}>
                {chapter.hasContent ? '✓' : 'New'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDialog = () => {
    if (!dialog.type) return null;

    const title = dialog.type === 'book' ? 'Add New Book' : 'Add New Chapter';
    const placeholder = dialog.type === 'book' ? 'Enter book name' : 'Enter chapter name';

    return (
      <div
        style={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-content-dialog-title"
        onClick={closeDialog}
      >
        <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <h3 id="add-content-dialog-title" style={styles.dialogTitle}>
            {title}
          </h3>

          <input
            type="text"
            value={dialog.name}
            onChange={handleDialogNameChange}
            placeholder={placeholder}
            maxLength={NAME_MAX_LENGTH + 10}
            style={styles.dialogInput}
            aria-label={placeholder}
            autoFocus
            disabled={dialog.isSaving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDialogSave();
              }
            }}
          />

          <p style={styles.dialogCharCount(dialog.name.trim().length > NAME_MAX_LENGTH)}>
            {dialog.name.trim().length}/{NAME_MAX_LENGTH}
          </p>

          {dialog.error && (
            <p style={styles.dialogError} role="alert" aria-live="assertive">
              {dialog.error}
            </p>
          )}

          <div style={styles.dialogButtons}>
            <button
              type="button"
              style={styles.dialogCancelBtn}
              onClick={closeDialog}
              disabled={dialog.isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              style={styles.dialogSaveBtn(dialog.isSaving)}
              onClick={handleDialogSave}
              disabled={dialog.isSaving}
              aria-busy={dialog.isSaving}
            >
              {dialog.isSaving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // === Mobile step-by-step rendering (Req 7.8) ===
  if (isMobile) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Content Ingestion</h1>

        <div style={styles.mobileLayout}>
          {mobileStep !== 'subjects' && (
            <button
              type="button"
              style={styles.mobileBackBtn}
              onClick={handleMobileBack}
              aria-label="Go back"
            >
              ← Back
            </button>
          )}

          {mobileStep === 'subjects' && renderSubjectList()}
          {mobileStep === 'books' && renderBookList()}
          {mobileStep === 'chapters' && renderChapterList()}
        </div>

        {renderDialog()}
      </div>
    );
  }

  // === Web layout: sidebar + main content (Req 7.7) ===
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Content Ingestion</h1>

      <div style={styles.webLayout}>
        {/* Left sidebar: subject list */}
        <div>
          <h2 style={{ ...styles.panelTitle, marginBottom: '12px' }}>Subjects</h2>
          {renderSubjectList()}
        </div>

        {/* Main content: books + chapters side by side */}
        <div style={styles.mainContent}>
          <div style={styles.panelsRow}>
            {renderBookList()}
            {renderChapterList()}
          </div>
        </div>
      </div>

      {renderDialog()}
    </div>
  );
};

export default ContentIngestionScreen;
