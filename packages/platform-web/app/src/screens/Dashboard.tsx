/**
 * Dashboard — Learner Dashboard screen for ChikuMiku LearnVerse.
 *
 * Displays personalized greeting (name truncated to 30 chars + date "Day, DD Month"),
 * current learning streak (fire icon, gold color, integer + "days" label),
 * a responsive subject card grid (2-col mobile / 3-col web), and handles
 * loading, error, and success states.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import React, { useEffect, useState, useCallback } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface SubjectCardData {
  subjectId: string;
  subjectName: string;
  color: string;
  iconName: string;
  progressPercentage: number; // 0-100
}

export interface DashboardProps {
  /** Student display name */
  studentName: string;
  /** Fetch streak data; returns current streak count */
  fetchStreak: () => Promise<number>;
  /** Fetch subjects with progress data */
  fetchSubjects: () => Promise<SubjectCardData[]>;
  /** Navigate to subject landing screen */
  onSubjectSelect: (subjectId: string) => void;
  /** Optional: override the current date (for testing) */
  currentDate?: Date;
}

interface DashboardState {
  streak: number | null;
  subjects: SubjectCardData[];
  streakLoading: boolean;
  subjectsLoading: boolean;
  streakError: string | null;
  subjectsError: string | null;
}

// ============================================================
// Constants
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  gold: '#F7C948',
  background: '#F8F5FF',
  dark: '#2C2341',
  white: '#FFFFFF',
  border: '#E0D8EC',
  muted: '#6B7280',
  error: '#E74C3C',
  errorBg: '#FDF2F2',
} as const;

const MAX_NAME_LENGTH = 30;

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Truncates a name to 30 characters max.
 * Requirement 6.1: Student name truncated to 30 characters if longer.
 */
export function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH);
}

/**
 * Formats a Date to "Day, DD Month" format.
 * Requirement 6.1: Date in format "Day, DD Month" (e.g., "Monday, 15 January").
 */
export function formatDate(date: Date): string {
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = MONTHS[date.getMonth()];
  return `${dayName}, ${dayNumber} ${monthName}`;
}

/**
 * Simple subject icon renderer using emoji/text as placeholder.
 * In production, would use an icon library.
 */
function getSubjectIcon(iconName: string): string {
  const icons: Record<string, string> = {
    kannada: 'ಕ',
    english: 'A',
    hindi: 'अ',
    maths: '∑',
    computers: '💻',
    evs: '🌿',
    science: '🔬',
  };
  return icons[iconName] ?? '📚';
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

  header: {
    marginBottom: '24px',
  } as React.CSSProperties,

  greeting: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 4px 0',
  } as React.CSSProperties,

  dateText: {
    fontSize: '13px',
    fontWeight: 400,
    color: COLORS.muted,
    margin: 0,
  } as React.CSSProperties,

  streakContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    width: 'fit-content',
  } as React.CSSProperties,

  streakIcon: {
    fontSize: '20px',
    color: COLORS.gold,
  } as React.CSSProperties,

  streakCount: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.gold,
    margin: 0,
  } as React.CSSProperties,

  streakLabel: {
    fontSize: '13px',
    fontWeight: 400,
    color: COLORS.muted,
    margin: 0,
  } as React.CSSProperties,

  subjectGrid: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(2, 1fr)',
  } as React.CSSProperties,

  subjectCard: (color: string): React.CSSProperties => ({
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '20px 16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    cursor: 'pointer',
    borderLeft: `4px solid ${color}`,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }),

  subjectIcon: (color: string): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: `${color}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    marginBottom: '12px',
  }),

  subjectName: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.dark,
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: COLORS.border,
    borderRadius: '3px',
    overflow: 'hidden',
  } as React.CSSProperties,

  progressFill: (percentage: number, color: string): React.CSSProperties => ({
    width: `${percentage}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  }),

  progressText: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.muted,
    minWidth: '36px',
    textAlign: 'right' as const,
  } as React.CSSProperties,

  loadingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    marginTop: '16px',
  } as React.CSSProperties,

  loadingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: COLORS.border,
    animation: 'pulse 1.2s ease-in-out infinite',
  } as React.CSSProperties,

  loadingText: {
    fontSize: '13px',
    color: COLORS.muted,
  } as React.CSSProperties,

  errorContainer: {
    backgroundColor: COLORS.errorBg,
    border: `1px solid ${COLORS.error}`,
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '16px',
    fontSize: '13px',
    color: COLORS.error,
  } as React.CSSProperties,

  placeholderCard: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    padding: '20px 16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    borderLeft: `4px solid ${COLORS.border}`,
  } as React.CSSProperties,

  placeholderBar: {
    height: '6px',
    backgroundColor: COLORS.border,
    borderRadius: '3px',
    width: '60%',
    marginTop: '8px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 16px 0',
  } as React.CSSProperties,
} as const;

// ============================================================
// Responsive CSS (injected via <style> tag)
// ============================================================

const RESPONSIVE_CSS = `
  @media (min-width: 960px) {
    .dashboard-subject-grid {
      grid-template-columns: repeat(3, 1fr) !important;
    }
  }
  @media (max-width: 959px) {
    .dashboard-subject-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  .dashboard-subject-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12) !important;
  }
  .dashboard-subject-card:active {
    transform: translateY(0);
  }
`;

// ============================================================
// Sub-Components
// ============================================================

/** Loading indicator for streak/progress areas */
const LoadingIndicator: React.FC<{ label: string }> = ({ label }) => (
  <div style={styles.loadingIndicator} role="status" aria-label={`Loading ${label}`}>
    <div style={{ ...styles.loadingDot, animationDelay: '0s' }} />
    <div style={{ ...styles.loadingDot, animationDelay: '0.2s' }} />
    <div style={{ ...styles.loadingDot, animationDelay: '0.4s' }} />
    <span style={styles.loadingText}>Loading {label}...</span>
  </div>
);

/** Error message display */
const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div style={styles.errorContainer} role="alert" aria-live="assertive">
    {message}
  </div>
);

/** Individual Subject Card */
const SubjectCard: React.FC<{
  subject: SubjectCardData;
  onSelect: (subjectId: string) => void;
  hasError: boolean;
}> = ({ subject, onSelect, hasError }) => {
  const handleClick = useCallback(() => {
    onSelect(subject.subjectId);
  }, [onSelect, subject.subjectId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(subject.subjectId);
      }
    },
    [onSelect, subject.subjectId],
  );

  return (
    <div
      className="dashboard-subject-card"
      style={styles.subjectCard(subject.color)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${subject.subjectName} - ${hasError ? 'progress unavailable' : `${subject.progressPercentage}% complete`}`}
    >
      <div style={styles.subjectIcon(subject.color)}>
        {getSubjectIcon(subject.iconName)}
      </div>
      <p style={styles.subjectName}>{subject.subjectName}</p>
      {hasError ? (
        <div style={styles.placeholderBar} aria-label="Progress unavailable" />
      ) : (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={styles.progressFill(subject.progressPercentage, subject.color)} />
          </div>
          <span style={styles.progressText}>{subject.progressPercentage}%</span>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Dashboard Component
// ============================================================

export const Dashboard: React.FC<DashboardProps> = ({
  studentName,
  fetchStreak,
  fetchSubjects,
  onSubjectSelect,
  currentDate,
}) => {
  const [state, setState] = useState<DashboardState>({
    streak: null,
    subjects: [],
    streakLoading: true,
    subjectsLoading: true,
    streakError: null,
    subjectsError: null,
  });

  // Fetch streak data
  useEffect(() => {
    let cancelled = false;

    const loadStreak = async () => {
      setState((prev) => ({ ...prev, streakLoading: true, streakError: null }));
      try {
        const streakCount = await fetchStreak();
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            streak: streakCount,
            streakLoading: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            streakLoading: false,
            streakError: 'Unable to load streak data. Please try again later.',
          }));
        }
      }
    };

    loadStreak();
    return () => { cancelled = true; };
  }, [fetchStreak]);

  // Fetch subjects with progress
  useEffect(() => {
    let cancelled = false;

    const loadSubjects = async () => {
      setState((prev) => ({ ...prev, subjectsLoading: true, subjectsError: null }));
      try {
        const subjects = await fetchSubjects();
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            subjects,
            subjectsLoading: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            subjectsLoading: false,
            subjectsError: 'Progress data is temporarily unavailable.',
          }));
        }
      }
    };

    loadSubjects();
    return () => { cancelled = true; };
  }, [fetchSubjects]);

  const displayDate = currentDate ?? new Date();
  const displayName = truncateName(studentName);
  const formattedDate = formatDate(displayDate);

  return (
    <>
      {/* Responsive styles */}
      <style>{RESPONSIVE_CSS}</style>

      <div style={styles.container}>
        {/* Greeting Header (Req 6.1) */}
        <header style={styles.header}>
          <h1 style={styles.greeting}>
            Hello, {displayName}!
          </h1>
          <p style={styles.dateText}>{formattedDate}</p>

          {/* Streak Display (Req 6.2) */}
          {state.streakLoading ? (
            <LoadingIndicator label="streak" />
          ) : state.streakError ? (
            <ErrorMessage message={state.streakError} />
          ) : (
            <div style={styles.streakContainer} aria-label={`Learning streak: ${state.streak} days`}>
              <span style={styles.streakIcon} role="img" aria-hidden="true">🔥</span>
              <span style={styles.streakCount}>{state.streak}</span>
              <span style={styles.streakLabel}>days</span>
            </div>
          )}
        </header>

        {/* Subject Cards Section (Req 6.3, 6.4, 6.5) */}
        <section aria-label="Your subjects">
          <h2 style={styles.sectionTitle}>Your Subjects</h2>

          {state.subjectsLoading ? (
            <LoadingIndicator label="subjects" />
          ) : state.subjectsError && state.subjects.length === 0 ? (
            <>
              <ErrorMessage message={state.subjectsError} />
              {/* Show placeholder cards (Req 6.8) */}
              <div
                className="dashboard-subject-grid"
                style={styles.subjectGrid}
              >
                {[1, 2, 3].map((i) => (
                  <div key={i} style={styles.placeholderCard}>
                    <div style={{ ...styles.placeholderBar, width: '40%', height: '12px', marginBottom: '12px', marginTop: 0 }} />
                    <div style={styles.placeholderBar} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {state.subjectsError && (
                <ErrorMessage message={state.subjectsError} />
              )}
              <div
                className="dashboard-subject-grid"
                style={styles.subjectGrid}
                role="list"
                aria-label="Subject cards"
              >
                {state.subjects.map((subject) => (
                  <div key={subject.subjectId} role="listitem">
                    <SubjectCard
                      subject={subject}
                      onSelect={onSubjectSelect}
                      hasError={!!state.subjectsError}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
};

export default Dashboard;
