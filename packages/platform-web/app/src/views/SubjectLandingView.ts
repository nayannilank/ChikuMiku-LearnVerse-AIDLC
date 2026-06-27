/**
 * SubjectLandingView — Vanilla-DOM view for the #subject-{name} route.
 *
 * Displays a subject header (name, icon, color, progress percentage) and a grid
 * of exercise-type navigation cards. The exercise links are conditionally
 * rendered based on subject category:
 *
 *   - Language subjects (Kannada, Hindi, English): Pronunciation + Grammar + Quiz + Content Ingestion
 *   - Maths: Maths Practice + Quiz + Content Ingestion
 *   - Computers: Computers Exercises + Quiz + Content Ingestion
 *   - EVS: EVS Visualizations + Quiz + Content Ingestion
 *   - Default (other): Quiz + Content Ingestion
 *
 * Design tokens:
 *   - Background: #F8F5FF
 *   - Border: #E0D8EC
 *   - Accent/button: #E94F9B
 *
 * Validates: Requirements 13.2, 13.3, 5.4, 6.3, 7.3, 8.3, 9.3, 10.3
 */

/** Represents a single exercise navigation link on the Subject Landing page. */
export interface ExerciseLink {
  label: string;
  icon: string;
  route: string; // e.g., 'pronunciation' → navigates to #pronunciation/{subjectId}
}

/** Subject categories determine which exercise links are shown. */
const LANGUAGE_SUBJECTS = ['kannada', 'hindi', 'english'];

const SUBJECT_EXERCISE_MAP: Record<string, ExerciseLink[]> = {
  language: [
    { label: 'Pronunciation Practice', icon: '🎙️', route: 'pronunciation' },
    { label: 'Grammar Exercises', icon: '📝', route: 'grammar' },
    { label: 'Take Quiz', icon: '⏱️', route: 'quiz' },
    { label: 'Content Ingestion', icon: '📷', route: 'scan' },
  ],
  maths: [
    { label: 'Maths Practice', icon: '📐', route: 'maths' },
    { label: 'Take Quiz', icon: '⏱️', route: 'quiz' },
    { label: 'Content Ingestion', icon: '📷', route: 'scan' },
  ],
  computers: [
    { label: 'Computers Exercises', icon: '🖥️', route: 'computers' },
    { label: 'Take Quiz', icon: '⏱️', route: 'quiz' },
    { label: 'Content Ingestion', icon: '📷', route: 'scan' },
  ],
  evs: [
    { label: 'EVS Visualizations', icon: '🌿', route: 'evs' },
    { label: 'Take Quiz', icon: '⏱️', route: 'quiz' },
    { label: 'Content Ingestion', icon: '📷', route: 'scan' },
  ],
  default: [
    { label: 'Take Quiz', icon: '⏱️', route: 'quiz' },
    { label: 'Content Ingestion', icon: '📷', route: 'scan' },
  ],
};

/**
 * Determines the exercise links available for a given subject name.
 *
 * @param subjectName - The subject name (case-insensitive).
 * @returns Array of ExerciseLink objects appropriate for that subject's category.
 */
export function getExerciseLinksForSubject(subjectName: string): ExerciseLink[] {
  const normalized = subjectName.toLowerCase();
  if (LANGUAGE_SUBJECTS.includes(normalized)) return SUBJECT_EXERCISE_MAP.language;
  if (normalized === 'maths') return SUBJECT_EXERCISE_MAP.maths;
  if (normalized === 'computers') return SUBJECT_EXERCISE_MAP.computers;
  if (normalized === 'evs') return SUBJECT_EXERCISE_MAP.evs;
  return SUBJECT_EXERCISE_MAP.default;
}

/**
 * Creates the Subject Landing view with a subject header and exercise link grid.
 *
 * @param subjectName - Display name of the subject.
 * @param subjectId - Unique identifier for the subject (used in navigation routes).
 * @param color - The subject's theme color (hex string).
 * @param icon - The subject's icon/emoji.
 * @param progressPercent - Current progress percentage (0–100).
 * @returns An HTMLElement representing the full Subject Landing view.
 */
export function createSubjectLandingView(
  subjectName: string,
  subjectId: string,
  color: string,
  icon: string,
  progressPercent: number
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'subject-landing-view';
  Object.assign(container.style, {
    padding: '1.5rem',
    maxWidth: '900px',
  });

  // --- Subject Header ---
  container.appendChild(createSubjectHeader(subjectName, color, icon, progressPercent));

  // --- Exercise Links Grid ---
  const exerciseLinks = getExerciseLinksForSubject(subjectName);
  container.appendChild(createExerciseLinkGrid(exerciseLinks, subjectId));

  return container;
}

/**
 * Creates the subject header section with name, icon, color indicator, and progress.
 */
function createSubjectHeader(
  subjectName: string,
  color: string,
  icon: string,
  progressPercent: number
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'subject-landing-view__header';
  Object.assign(header.style, {
    backgroundColor: '#F8F5FF',
    borderRadius: '14px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid #E0D8EC',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  });

  // Subject icon with color background
  const iconEl = document.createElement('div');
  iconEl.className = 'subject-landing-view__icon';
  iconEl.textContent = icon;
  iconEl.setAttribute('aria-hidden', 'true');
  Object.assign(iconEl.style, {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    backgroundColor: `${color}20`,
    border: `2px solid ${color}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    flexShrink: '0',
  });
  header.appendChild(iconEl);

  // Text section (name + progress)
  const textSection = document.createElement('div');
  textSection.style.flex = '1';

  const nameEl = document.createElement('h1');
  nameEl.className = 'subject-landing-view__name';
  nameEl.textContent = subjectName;
  Object.assign(nameEl.style, {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#2C2341',
    margin: '0 0 0.5rem 0',
  });
  textSection.appendChild(nameEl);

  // Progress bar
  const progressContainer = document.createElement('div');
  Object.assign(progressContainer.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  });

  const track = document.createElement('div');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuenow', String(Math.round(progressPercent)));
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-label', `${subjectName} progress`);
  Object.assign(track.style, {
    flex: '1',
    height: '10px',
    backgroundColor: '#E0D8EC',
    borderRadius: '5px',
    overflow: 'hidden',
  });

  const fill = document.createElement('div');
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  Object.assign(fill.style, {
    width: `${clampedPercent}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: '5px',
    transition: 'width 0.3s ease',
  });
  track.appendChild(fill);
  progressContainer.appendChild(track);

  const percentLabel = document.createElement('span');
  percentLabel.className = 'subject-landing-view__progress-label';
  percentLabel.textContent = `${Math.round(progressPercent)}%`;
  Object.assign(percentLabel.style, {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: color,
    minWidth: '3ch',
  });
  progressContainer.appendChild(percentLabel);

  textSection.appendChild(progressContainer);
  header.appendChild(textSection);

  return header;
}

/**
 * Creates the exercise link grid.
 */
function createExerciseLinkGrid(links: ExerciseLink[], subjectId: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'subject-landing-view__grid';
  Object.assign(section.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  });

  for (const link of links) {
    section.appendChild(createExerciseLinkCard(link, subjectId));
  }

  return section;
}

/**
 * Creates a single exercise link card that navigates on click.
 */
function createExerciseLinkCard(link: ExerciseLink, subjectId: string): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'subject-landing-view__exercise-card';
  card.setAttribute('aria-label', link.label);
  Object.assign(card.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem 1rem',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E0D8EC',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    textAlign: 'center',
    gap: '0.75rem',
  });

  // Hover effects
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-3px)';
    card.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.1)';
    card.style.borderColor = '#E94F9B';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.06)';
    card.style.borderColor = '#E0D8EC';
  });

  // Icon
  const iconEl = document.createElement('span');
  iconEl.textContent = link.icon;
  iconEl.setAttribute('aria-hidden', 'true');
  Object.assign(iconEl.style, {
    fontSize: '2rem',
  });
  card.appendChild(iconEl);

  // Label
  const labelEl = document.createElement('span');
  labelEl.textContent = link.label;
  Object.assign(labelEl.style, {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2C2341',
  });
  card.appendChild(labelEl);

  // Navigation on click
  card.addEventListener('click', () => {
    // Content Ingestion route is just #scan (no subjectId parameter)
    if (link.route === 'scan') {
      window.location.hash = '#scan';
    } else {
      window.location.hash = `#${link.route}/${subjectId}`;
    }
  });

  return card;
}
