/**
 * ProgressView — Vanilla-DOM view for the #progress route.
 *
 * Renders per-subject progress bars, current streak display, and recent activity list.
 * Uses design-system tokens: background #F8F5FF, border #E0D8EC, accent #E94F9B.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */

import type { StudentProgress, Streak } from '@learnverse/platform-contracts';

/** Data passed to the progress view for rendering. */
export interface ProgressViewData {
  progress: StudentProgress[];
  streak: Streak;
}

/**
 * Creates the Progress view element showing per-subject progress bars,
 * current streak, and recent activity.
 *
 * @param data - The progress and streak data fetched from the API.
 * @returns An HTMLElement representing the full progress view.
 */
export function createProgressView(data: ProgressViewData): HTMLElement {
  const container = document.createElement('div');
  container.className = 'progress-view';
  Object.assign(container.style, {
    padding: '1.5rem',
    maxWidth: '900px',
  });

  // --- Page Header ---
  const header = document.createElement('h1');
  header.textContent = 'My Progress';
  Object.assign(header.style, {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#2C2341',
    marginBottom: '1.5rem',
    marginTop: '0',
  });
  container.appendChild(header);

  // --- Streak Section ---
  container.appendChild(createStreakSection(data.streak));

  // --- Progress Bars Section ---
  container.appendChild(createProgressBarsSection(data.progress));

  // --- Recent Activity Section ---
  container.appendChild(createRecentActivitySection(data.progress));

  return container;
}

/**
 * Creates the streak display section.
 */
function createStreakSection(streak: Streak): HTMLElement {
  const section = document.createElement('div');
  section.className = 'progress-view__streak';
  Object.assign(section.style, {
    backgroundColor: '#F8F5FF',
    borderRadius: '14px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid #E0D8EC',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  });

  // Streak icon
  const icon = document.createElement('div');
  icon.textContent = '🔥';
  Object.assign(icon.style, {
    fontSize: '2.5rem',
    lineHeight: '1',
  });
  section.appendChild(icon);

  // Streak text
  const textContainer = document.createElement('div');

  const streakCount = document.createElement('div');
  streakCount.className = 'progress-view__streak-count';
  streakCount.textContent = `${streak.currentStreak} day streak`;
  Object.assign(streakCount.style, {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#2C2341',
  });
  textContainer.appendChild(streakCount);

  const lastActive = document.createElement('div');
  lastActive.className = 'progress-view__last-active';
  if (streak.lastActivityDate) {
    const date = new Date(streak.lastActivityDate);
    lastActive.textContent = `Last active: ${date.toLocaleDateString()}`;
  } else {
    lastActive.textContent = 'Start learning to build your streak!';
  }
  Object.assign(lastActive.style, {
    fontSize: '0.8rem',
    color: '#6B7280',
    marginTop: '0.25rem',
  });
  textContainer.appendChild(lastActive);

  section.appendChild(textContainer);

  return section;
}

/**
 * Creates the per-subject progress bars section.
 */
function createProgressBarsSection(progress: StudentProgress[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'progress-view__bars';
  Object.assign(section.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid #E0D8EC',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  });

  const title = document.createElement('h2');
  title.textContent = 'Subject Progress';
  Object.assign(title.style, {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#2C2341',
    marginTop: '0',
    marginBottom: '1.25rem',
  });
  section.appendChild(title);

  if (progress.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No progress data available yet. Start learning to see your progress!';
    Object.assign(emptyMsg.style, {
      fontSize: '0.85rem',
      color: '#6B7280',
      textAlign: 'center',
      padding: '1rem 0',
    });
    section.appendChild(emptyMsg);
    return section;
  }

  for (const subjectProgress of progress) {
    section.appendChild(createProgressBar(subjectProgress));
  }

  return section;
}

/**
 * Creates a single subject progress bar.
 */
function createProgressBar(subjectProgress: StudentProgress): HTMLElement {
  const row = document.createElement('div');
  row.className = 'progress-view__bar-row';
  Object.assign(row.style, {
    marginBottom: '1rem',
  });

  // Label row with subject name and percentage
  const labelRow = document.createElement('div');
  Object.assign(labelRow.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.4rem',
  });

  const subjectLabel = document.createElement('span');
  subjectLabel.textContent = subjectProgress.subjectId;
  Object.assign(subjectLabel.style, {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2C2341',
    textTransform: 'capitalize',
  });
  labelRow.appendChild(subjectLabel);

  const percentLabel = document.createElement('span');
  percentLabel.textContent = `${Math.round(subjectProgress.progressPercentage)}%`;
  Object.assign(percentLabel.style, {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#E94F9B',
  });
  labelRow.appendChild(percentLabel);

  row.appendChild(labelRow);

  // Progress bar track
  const track = document.createElement('div');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuenow', String(Math.round(subjectProgress.progressPercentage)));
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-label', `${subjectProgress.subjectId} progress`);
  Object.assign(track.style, {
    width: '100%',
    height: '10px',
    backgroundColor: '#E0D8EC',
    borderRadius: '5px',
    overflow: 'hidden',
  });

  // Progress bar fill
  const fill = document.createElement('div');
  const percentage = Math.min(100, Math.max(0, subjectProgress.progressPercentage));
  Object.assign(fill.style, {
    width: `${percentage}%`,
    height: '100%',
    backgroundColor: '#E94F9B',
    borderRadius: '5px',
    transition: 'width 0.3s ease',
  });
  track.appendChild(fill);

  row.appendChild(track);

  // Completed / total exercises
  const detail = document.createElement('div');
  detail.textContent = `${subjectProgress.completedExercises} / ${subjectProgress.totalExercises} exercises completed`;
  Object.assign(detail.style, {
    fontSize: '0.7rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  });
  row.appendChild(detail);

  return row;
}

/**
 * Creates the recent activity section based on progress data.
 */
function createRecentActivitySection(progress: StudentProgress[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'progress-view__activity';
  Object.assign(section.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '1.5rem',
    border: '1px solid #E0D8EC',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  });

  const title = document.createElement('h2');
  title.textContent = 'Recent Activity';
  Object.assign(title.style, {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#2C2341',
    marginTop: '0',
    marginBottom: '1rem',
  });
  section.appendChild(title);

  // Derive activity items from progress data — show subjects with completed exercises
  const activeSubjects = progress.filter((p) => p.completedExercises > 0);

  if (activeSubjects.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No recent activity. Complete some exercises to see your activity here!';
    Object.assign(emptyMsg.style, {
      fontSize: '0.85rem',
      color: '#6B7280',
      textAlign: 'center',
      padding: '1rem 0',
    });
    section.appendChild(emptyMsg);
    return section;
  }

  const list = document.createElement('ul');
  Object.assign(list.style, {
    listStyle: 'none',
    padding: '0',
    margin: '0',
  });

  for (const subjectProgress of activeSubjects) {
    const item = document.createElement('li');
    Object.assign(item.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0',
      borderBottom: '1px solid #F3F4F6',
    });

    // Activity icon
    const actIcon = document.createElement('span');
    actIcon.textContent = '✅';
    Object.assign(actIcon.style, { fontSize: '1.1rem' });
    item.appendChild(actIcon);

    // Activity text
    const actText = document.createElement('span');
    actText.textContent = `Completed ${subjectProgress.completedExercises} exercises in ${subjectProgress.subjectId}`;
    Object.assign(actText.style, {
      fontSize: '0.85rem',
      color: '#2C2341',
      textTransform: 'capitalize',
    });
    item.appendChild(actText);

    list.appendChild(item);
  }

  // Remove the last item's border
  const lastItem = list.lastElementChild as HTMLElement | null;
  if (lastItem) {
    lastItem.style.borderBottom = 'none';
  }

  section.appendChild(list);

  return section;
}
