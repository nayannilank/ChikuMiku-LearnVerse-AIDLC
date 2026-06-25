/**
 * ParentDashboard — React component for the Parent Dashboard screen.
 *
 * Displays the parent's list of registered students with name + grade,
 * allows viewing individual student progress (subject cards with progress %,
 * streak, recent activity), provides "Register Student" navigation,
 * empty state prompt, and "Edit Subjects" dialog with min-1 validation.
 *
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7
 */

import React, { useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

export interface SubjectProgress {
  subjectName: string;
  progressPercent: number;
  streak: number;
  recentActivity: string;
}

export interface Learner {
  id: string;
  name: string;
  grade: string;
  subjects: string[];
  progress: SubjectProgress[];
}

export interface ParentDashboardProps {
  /** List of learners registered by this parent */
  learners: Learner[];
  /** All available subjects that can be assigned */
  availableSubjects: string[];
  /** Callback when "Register Student" is clicked */
  onRegisterStudent: () => void;
  /** Callback when subjects are updated for a learner */
  onUpdateSubjects: (learnerId: string, subjects: string[]) => Promise<void>;
  /** Whether the dashboard data is loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
}

// ============================================================
// Design Tokens
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
  skyBlue: '#5DADE2',
  gold: '#F7C948',
  indigo: '#4A6CF7',
  teal: '#4ECDC4',
} as const;

const SUBJECT_COLORS: Record<string, string> = {
  Kannada: '#9B59B6',
  English: '#5DADE2',
  Hindi: '#F7C948',
  Maths: '#E94F9B',
  Computers: '#4A6CF7',
  EVS: '#27AE60',
  Science: '#4ECDC4',
};

// ============================================================
// Styles
// ============================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: COLORS.background,
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  content: {
    maxWidth: '720px',
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,

  heading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  registerButton: {
    padding: '10px 20px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Empty State (Req 22.5)
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  } as React.CSSProperties,

  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  } as React.CSSProperties,

  emptyText: {
    fontSize: '14px',
    color: COLORS.muted,
    marginBottom: '20px',
  } as React.CSSProperties,

  // Learner List (Req 22.2)
  learnerCard: {
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    padding: '16px 20px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  } as React.CSSProperties,

  learnerInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,

  learnerName: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.dark,
  } as React.CSSProperties,

  learnerGrade: {
    fontSize: '12px',
    color: COLORS.muted,
  } as React.CSSProperties,

  learnerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  editSubjectsBtn: {
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '16px',
    backgroundColor: COLORS.white,
    color: COLORS.secondary,
    cursor: 'pointer',
  } as React.CSSProperties,

  chevron: {
    fontSize: '14px',
    color: COLORS.muted,
  } as React.CSSProperties,

  // Progress View (Req 22.3)
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  } as React.CSSProperties,

  backBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '16px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  progressTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '14px',
  } as React.CSSProperties,

  subjectCard: (color: string): React.CSSProperties => ({
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    padding: '16px',
    borderLeft: `4px solid ${color}`,
  }),

  subjectName: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '10px',
  } as React.CSSProperties,

  progressBarContainer: {
    height: '6px',
    borderRadius: '3px',
    backgroundColor: COLORS.border,
    marginBottom: '8px',
    overflow: 'hidden',
  } as React.CSSProperties,

  progressBar: (percent: number, color: string): React.CSSProperties => ({
    height: '100%',
    borderRadius: '3px',
    backgroundColor: color,
    width: `${Math.min(100, Math.max(0, percent))}%`,
    transition: 'width 0.3s ease',
  }),

  progressPercent: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '6px',
  } as React.CSSProperties,

  streakText: {
    fontSize: '11px',
    color: COLORS.gold,
    fontWeight: 600,
    marginBottom: '4px',
  } as React.CSSProperties,

  activityText: {
    fontSize: '11px',
    color: COLORS.muted,
  } as React.CSSProperties,

  // Dialog (Req 22.6, 22.7)
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
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  } as React.CSSProperties,

  dialogTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 16px 0',
  } as React.CSSProperties,

  dialogSubjects: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginBottom: '16px',
  } as React.CSSProperties,

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  checkbox: {
    accentColor: COLORS.primary,
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  } as React.CSSProperties,

  dialogError: {
    fontSize: '11px',
    color: COLORS.error,
    marginBottom: '12px',
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

  // Loading & Error states
  loadingContainer: {
    textAlign: 'center' as const,
    padding: '60px 20px',
  } as React.CSSProperties,

  loadingText: {
    fontSize: '14px',
    color: COLORS.muted,
  } as React.CSSProperties,

  errorBanner: {
    backgroundColor: COLORS.errorBg,
    border: `1px solid ${COLORS.error}`,
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    fontSize: '12px',
    color: COLORS.error,
  } as React.CSSProperties,
} as const;

// ============================================================
// Helper
// ============================================================

function getSubjectColor(subjectName: string): string {
  return SUBJECT_COLORS[subjectName] ?? COLORS.secondary;
}

// ============================================================
// Component
// ============================================================

/**
 * ParentDashboard React component.
 *
 * Renders the parent's learner list or individual learner progress view,
 * with an "Edit Subjects" dialog and empty state handling.
 */
export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  learners,
  availableSubjects,
  onRegisterStudent,
  onUpdateSubjects,
  isLoading = false,
  error = null,
}) => {
  // View state: list or progress for a specific learner
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);

  // Edit Subjects dialog state
  const [editDialogLearnerId, setEditDialogLearnerId] = useState<string | null>(null);
  const [editSubjectsSelection, setEditSubjectsSelection] = useState<string[]>([]);
  const [editSubjectsError, setEditSubjectsError] = useState<string | null>(null);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);

  const selectedLearner = learners.find((l) => l.id === selectedLearnerId) ?? null;
  const editDialogLearner = learners.find((l) => l.id === editDialogLearnerId) ?? null;

  // === Handlers ===

  const handleLearnerTap = useCallback((learnerId: string) => {
    setSelectedLearnerId(learnerId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedLearnerId(null);
  }, []);

  const handleOpenEditSubjects = useCallback((e: React.MouseEvent, learner: Learner) => {
    e.stopPropagation();
    setEditDialogLearnerId(learner.id);
    setEditSubjectsSelection([...learner.subjects]);
    setEditSubjectsError(null);
  }, []);

  const handleToggleSubject = useCallback((subject: string) => {
    setEditSubjectsSelection((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((s) => s !== subject);
      }
      return [...prev, subject];
    });
    setEditSubjectsError(null);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditDialogLearnerId(null);
    setEditSubjectsSelection([]);
    setEditSubjectsError(null);
  }, []);

  const handleSaveSubjects = useCallback(async () => {
    // Req 22.7: Enforce minimum 1 subject
    if (editSubjectsSelection.length === 0) {
      setEditSubjectsError('At least one subject must be selected');
      return;
    }

    if (!editDialogLearnerId) return;

    setIsSavingSubjects(true);
    try {
      await onUpdateSubjects(editDialogLearnerId, editSubjectsSelection);
      handleCloseEditDialog();
    } catch {
      setEditSubjectsError('Failed to save subjects. Please try again.');
    } finally {
      setIsSavingSubjects(false);
    }
  }, [editSubjectsSelection, editDialogLearnerId, onUpdateSubjects, handleCloseEditDialog]);

  // === Loading State ===

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.loadingContainer}>
            <p style={styles.loadingText}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // === Progress View (Req 22.3) ===

  if (selectedLearner) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          {/* Error banner */}
          {error && (
            <div style={styles.errorBanner} role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <div style={styles.progressHeader}>
            <button
              type="button"
              style={styles.backBtn}
              onClick={handleBackToList}
              aria-label="Back to learner list"
            >
              ← Back
            </button>
            <h2 style={styles.progressTitle}>
              {selectedLearner.name}&apos;s Progress
            </h2>
          </div>

          <div style={styles.subjectsGrid}>
            {selectedLearner.progress.map((sp) => {
              const color = getSubjectColor(sp.subjectName);
              return (
                <div
                  key={sp.subjectName}
                  style={styles.subjectCard(color)}
                  aria-label={`${sp.subjectName} progress card`}
                >
                  <div style={styles.subjectName}>{sp.subjectName}</div>
                  <div style={styles.progressBarContainer}>
                    <div style={styles.progressBar(sp.progressPercent, color)} />
                  </div>
                  <div style={styles.progressPercent}>{sp.progressPercent}%</div>
                  <div style={styles.streakText}>🔥 {sp.streak} day streak</div>
                  <div style={styles.activityText}>{sp.recentActivity}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // === Learner List View (Req 22.2) ===

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner} role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {/* Header with Register Student button (Req 22.4) */}
        <div style={styles.header}>
          <h1 style={styles.heading}>Parent Dashboard</h1>
          <button
            type="button"
            style={styles.registerButton}
            onClick={onRegisterStudent}
            aria-label="Register Student"
          >
            Register Student
          </button>
        </div>

        {/* Empty state (Req 22.5) */}
        {learners.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon} aria-hidden="true">📚</div>
            <p style={styles.emptyText}>
              No learners yet — register your first student!
            </p>
            <button
              type="button"
              style={styles.registerButton}
              onClick={onRegisterStudent}
              aria-label="Register Student"
            >
              Register Student
            </button>
          </div>
        ) : (
          /* Learner cards */
          <div role="list" aria-label="Registered students">
            {learners.map((learner) => (
              <div
                key={learner.id}
                role="listitem"
                style={styles.learnerCard}
                onClick={() => handleLearnerTap(learner.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLearnerTap(learner.id);
                  }
                }}
                tabIndex={0}
                aria-label={`View progress for ${learner.name}`}
              >
                <div style={styles.learnerInfo}>
                  <span style={styles.learnerName}>{learner.name}</span>
                  <span style={styles.learnerGrade}>Grade: {learner.grade}</span>
                </div>
                <div style={styles.learnerActions}>
                  {/* Edit Subjects button (Req 22.6) */}
                  <button
                    type="button"
                    style={styles.editSubjectsBtn}
                    onClick={(e) => handleOpenEditSubjects(e, learner)}
                    aria-label={`Edit subjects for ${learner.name}`}
                  >
                    Edit Subjects
                  </button>
                  <span style={styles.chevron} aria-hidden="true">›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Subjects Dialog (Req 22.6, 22.7) */}
      {editDialogLearner && (
        <div
          style={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-subjects-title"
          onClick={handleCloseEditDialog}
        >
          <div
            style={styles.dialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-subjects-title" style={styles.dialogTitle}>
              Edit Subjects — {editDialogLearner.name}
            </h3>

            <div style={styles.dialogSubjects} role="group" aria-label="Subject checkboxes">
              {availableSubjects.map((subject) => (
                <label key={subject} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editSubjectsSelection.includes(subject)}
                    onChange={() => handleToggleSubject(subject)}
                    disabled={isSavingSubjects}
                    style={styles.checkbox}
                    aria-label={subject}
                  />
                  {subject}
                </label>
              ))}
            </div>

            {/* Error message (Req 22.7) */}
            {editSubjectsError && (
              <p style={styles.dialogError} role="alert" aria-live="assertive">
                {editSubjectsError}
              </p>
            )}

            <div style={styles.dialogButtons}>
              <button
                type="button"
                style={styles.dialogCancelBtn}
                onClick={handleCloseEditDialog}
                disabled={isSavingSubjects}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.dialogSaveBtn(isSavingSubjects)}
                onClick={handleSaveSubjects}
                disabled={isSavingSubjects}
                aria-busy={isSavingSubjects}
              >
                {isSavingSubjects ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
