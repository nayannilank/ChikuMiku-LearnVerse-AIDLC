import './styles/design-tokens.css';
import './styles/home.css';

import { createElement } from 'react';
import { createRouter } from './router/HashRouter';
import { createLandingView } from './views/LandingView';
import { createLoginView } from './views/LoginView';
import { createParentRegistrationView } from './views/ParentRegistrationView';
import { createStudentRegistrationView } from './views/StudentRegistrationView';
import { createForgotPasswordView } from './views/ForgotPasswordView';
import { createResetPasswordView } from './views/ResetPasswordView';
import { clearTokens, getAccessToken, comprehensionApi, contentApi, ingestionApi, pronunciationApi, progressApi, parentApi } from './services/api';
import { createSubjectLandingView } from './views/SubjectLandingView';
import { createProgressView } from './views/ProgressView';
import { createLoadingView } from './components/LoadingView';
import { createErrorView } from './components/ErrorView';
import { wrapInResponsiveLayout } from './utils/wrapInResponsiveLayout';
import { createAsyncRouteContainer } from './utils/asyncRoute';
import { TreeSidebarProps } from './components/TreeSidebar';
import { ContentIngestionScreen } from './screens/ContentIngestionScreen';
import { PageUploadUI } from './screens/PageUploadUI';
import { ChapterTranscript } from './screens/ChapterTranscript';
import { ChapterExplanationScreen } from './screens/ChapterExplanationScreen';
import { ExerciseAssistant, ExerciseItemType } from './screens/ExerciseAssistant';
import { PronunciationScreen } from './screens/PronunciationScreen';
import { GrammarExerciseScreen } from './screens/GrammarExerciseScreen';
import { QuizScreen } from './screens/QuizScreen';
import { MathsPracticeScreen } from './screens/MathsPracticeScreen';
import { ComputersExerciseScreen } from './screens/ComputersExerciseScreen';
import { EVSVisualizationScreen } from './screens/EVSVisualizationScreen';
import { ParentDashboard } from './screens/ParentDashboard';
import type { Streak } from '@learnverse/platform-contracts';

/** Creates the Parent Dashboard content — fetches learners from API. */
function createDashboardContent(): HTMLElement {
  const content = document.createElement('div');
  content.className = 'dashboard-content';
  Object.assign(content.style, {
    padding: '1.5rem',
    maxWidth: '900px',
  });

  const username = localStorage.getItem('learnverse_username') || 'Parent';

  // Welcome header
  const welcomeBar = document.createElement('div');
  Object.assign(welcomeBar.style, {
    background: 'linear-gradient(135deg, #FDE8F4, #F3E8F9)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  });
  const welcomeLeft = document.createElement('div');
  const welcomeTitle = document.createElement('div');
  welcomeTitle.textContent = `Welcome, ${username}! 👋`;
  Object.assign(welcomeTitle.style, {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#2C2341',
  });
  welcomeLeft.appendChild(welcomeTitle);
  const welcomeSub = document.createElement('div');
  welcomeSub.textContent = 'Manage your learners and track their progress.';
  Object.assign(welcomeSub.style, {
    fontSize: '0.8rem',
    color: '#6B7280',
    marginTop: '4px',
  });
  welcomeLeft.appendChild(welcomeSub);
  welcomeBar.appendChild(welcomeLeft);

  const addLearnerBtn = document.createElement('button');
  addLearnerBtn.type = 'button';
  addLearnerBtn.textContent = '+ Add Learner';
  Object.assign(addLearnerBtn.style, {
    padding: '0.5rem 1.2rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#E94F9B',
    border: 'none',
    borderRadius: '22px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  });
  addLearnerBtn.addEventListener('mouseenter', () => {
    addLearnerBtn.style.backgroundColor = '#d4408a';
  });
  addLearnerBtn.addEventListener('mouseleave', () => {
    addLearnerBtn.style.backgroundColor = '#E94F9B';
  });
  addLearnerBtn.addEventListener('click', () => {
    window.location.hash = '#add-learner';
  });
  welcomeBar.appendChild(addLearnerBtn);
  content.appendChild(welcomeBar);

  // Learner list container — starts with loading state
  const learnerContainer = document.createElement('div');
  learnerContainer.setAttribute('aria-live', 'polite');
  content.appendChild(learnerContainer);

  // Show loading indicator
  renderLoadingState(learnerContainer);

  // Fetch learners from API
  fetchParentLearners().then((learners) => {
    learnerContainer.innerHTML = '';
    if (learners.length === 0) {
      renderEmptyState(learnerContainer);
    } else {
      renderLearnerCards(learnerContainer, learners);
    }
  }).catch(() => {
    learnerContainer.innerHTML = '';
    renderEmptyState(learnerContainer, true);
  });

  return content;
}

/** Renders the loading state inside the container. */
function renderLoadingState(container: HTMLElement): void {
  const loadingEl = document.createElement('div');
  Object.assign(loadingEl.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    border: '1px solid #E0D8EC',
  });
  loadingEl.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 0.75rem;">⏳</div>
    <div style="font-size: 1rem; font-weight: 600; color: #2C2341;">Loading learners...</div>
    <div style="font-size: 0.8rem; color: #6B7280; margin-top: 0.25rem;">Fetching data from API</div>
  `;
  container.appendChild(loadingEl);
}

/** Renders the empty state (no learners) inside the container. */
function renderEmptyState(container: HTMLElement, isError = false): void {
  const emptyState = document.createElement('div');
  Object.assign(emptyState.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    border: '1px solid #E0D8EC',
  });

  const emptyIcon = document.createElement('div');
  emptyIcon.textContent = '👨‍👩‍👧‍👦';
  Object.assign(emptyIcon.style, { fontSize: '3rem', marginBottom: '1rem' });
  emptyState.appendChild(emptyIcon);

  const emptyTitle = document.createElement('div');
  emptyTitle.textContent = 'No learners registered yet';
  Object.assign(emptyTitle.style, {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#2C2341',
    marginBottom: '0.5rem',
  });
  emptyState.appendChild(emptyTitle);

  const emptyDesc = document.createElement('div');
  emptyDesc.textContent = isError
    ? 'Could not connect to the server. Add a new learner to get started.'
    : 'Add a new learner to get started.';
  Object.assign(emptyDesc.style, {
    fontSize: '0.85rem',
    color: '#6B7280',
    marginBottom: '1.5rem',
  });
  emptyState.appendChild(emptyDesc);

  if (isError) {
    const errorNote = document.createElement('div');
    errorNote.textContent = '⚠️ API unavailable — showing offline state';
    Object.assign(errorNote.style, {
      fontSize: '0.75rem',
      color: '#9CA3AF',
      fontStyle: 'italic',
      marginBottom: '1rem',
    });
    emptyState.appendChild(errorNote);
  }

  const emptyAddBtn = document.createElement('button');
  emptyAddBtn.type = 'button';
  emptyAddBtn.textContent = '+ Add Learner';
  Object.assign(emptyAddBtn.style, {
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#E94F9B',
    border: 'none',
    borderRadius: '22px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  });
  emptyAddBtn.addEventListener('mouseenter', () => {
    emptyAddBtn.style.backgroundColor = '#d4408a';
  });
  emptyAddBtn.addEventListener('mouseleave', () => {
    emptyAddBtn.style.backgroundColor = '#E94F9B';
  });
  emptyAddBtn.addEventListener('click', () => {
    window.location.hash = '#add-learner';
  });
  emptyState.appendChild(emptyAddBtn);

  container.appendChild(emptyState);
}

/** Renders learner cards inside the container. */
function renderLearnerCards(
  container: HTMLElement,
  learners: Array<{ id: string; name: string; grade: string; subjects: string[] }>
): void {
  for (const learner of learners) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      backgroundColor: '#FFFFFF',
      borderRadius: '14px',
      padding: '1.25rem 1.5rem',
      marginBottom: '1rem',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
      border: '1px solid #E0D8EC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    const infoSection = document.createElement('div');

    const nameEl = document.createElement('div');
    nameEl.textContent = learner.name;
    Object.assign(nameEl.style, {
      fontSize: '1rem',
      fontWeight: '700',
      color: '#2C2341',
      marginBottom: '0.25rem',
    });
    infoSection.appendChild(nameEl);

    const gradeEl = document.createElement('div');
    gradeEl.textContent = `Grade: ${learner.grade}`;
    Object.assign(gradeEl.style, {
      fontSize: '0.8rem',
      color: '#6B7280',
      marginBottom: '0.5rem',
    });
    infoSection.appendChild(gradeEl);

    // Subject pills
    if (learner.subjects.length > 0) {
      const pillContainer = document.createElement('div');
      Object.assign(pillContainer.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
      });

      const PILL_COLORS = ['#E94F9B', '#7C3AED', '#2563EB', '#059669', '#D97706'];
      learner.subjects.forEach((subject, idx) => {
        const pill = document.createElement('span');
        pill.textContent = subject;
        const color = PILL_COLORS[idx % PILL_COLORS.length];
        Object.assign(pill.style, {
          display: 'inline-block',
          padding: '0.2rem 0.6rem',
          fontSize: '0.7rem',
          fontWeight: '600',
          color: '#FFFFFF',
          backgroundColor: color,
          borderRadius: '12px',
        });
        pillContainer.appendChild(pill);
      });
      infoSection.appendChild(pillContainer);
    } else {
      const noSubjects = document.createElement('div');
      noSubjects.textContent = 'No subjects assigned yet';
      Object.assign(noSubjects.style, {
        fontSize: '0.75rem',
        color: '#9CA3AF',
        fontStyle: 'italic',
      });
      infoSection.appendChild(noSubjects);
    }

    card.appendChild(infoSection);

    // View button
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.textContent = 'View';
    Object.assign(viewBtn.style, {
      padding: '0.4rem 1rem',
      fontSize: '0.8rem',
      fontWeight: '600',
      color: '#E94F9B',
      backgroundColor: 'transparent',
      border: '2px solid #E94F9B',
      borderRadius: '18px',
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s',
    });
    viewBtn.addEventListener('mouseenter', () => {
      viewBtn.style.backgroundColor = '#E94F9B';
      viewBtn.style.color = '#FFFFFF';
    });
    viewBtn.addEventListener('mouseleave', () => {
      viewBtn.style.backgroundColor = 'transparent';
      viewBtn.style.color = '#E94F9B';
    });
    viewBtn.addEventListener('click', () => {
      window.location.hash = `#edit-subjects/${learner.id}`;
    });
    card.appendChild(viewBtn);

    container.appendChild(card);
  }
}

/** Fetches learners for the authenticated parent from the API. */
async function fetchParentLearners(): Promise<
  Array<{ id: string; name: string; grade: string; subjects: string[] }>
> {
  const tokensRaw = localStorage.getItem('learnverse_tokens');
  let accessToken = '';
  if (tokensRaw) {
    try {
      const parsed = JSON.parse(tokensRaw);
      accessToken = parsed.accessToken || '';
    } catch {
      // Invalid token data
    }
  }

  const response = await fetch('/api/v1/parent/learners', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

/** Creates a generic authenticated page placeholder. */
function createPagePlaceholder(title: string): HTMLElement {
  const content = document.createElement('div');
  content.className = 'page-content';
  content.innerHTML = `<h1>${title}</h1><p>This section is under construction.</p>`;
  return content;
}

/**
 * Extracts the student/user ID from the stored JWT access token.
 * Decodes the JWT payload (base64url) to retrieve the `sub` claim.
 * Returns null if no valid token is found.
 */
function getStudentIdFromToken(): string | null {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url payload
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded);
    return parsed.sub || parsed.userId || null;
  } catch {
    return null;
  }
}

/** Creates the Learner Dashboard content — fetches subjects from API. */
function createLearnerDashboardContent(): HTMLElement {
  const content = document.createElement('div');
  content.className = 'learner-dashboard-content';
  Object.assign(content.style, {
    padding: '1.5rem',
    maxWidth: '900px',
  });

  const username = localStorage.getItem('learnverse_username') || 'Learner';

  // --- Welcome / Greeting Banner ---
  const greetingBanner = document.createElement('div');
  Object.assign(greetingBanner.style, {
    background: 'linear-gradient(135deg, #FDE8F4, #F3E8F9)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  });

  const greetingTitle = document.createElement('div');
  greetingTitle.textContent = `Hi, ${username}! 👋`;
  Object.assign(greetingTitle.style, {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#2C2341',
    marginBottom: '0.25rem',
  });
  greetingBanner.appendChild(greetingTitle);

  const greetingMessage = document.createElement('div');
  greetingMessage.textContent = 'Welcome! Your learning journey starts here.';
  Object.assign(greetingMessage.style, {
    fontSize: '0.85rem',
    color: '#6B7280',
  });
  greetingBanner.appendChild(greetingMessage);

  content.appendChild(greetingBanner);

  // --- Subjects container (async loaded) ---
  const subjectsContainer = document.createElement('div');
  subjectsContainer.setAttribute('aria-live', 'polite');
  content.appendChild(subjectsContainer);

  // Show loading state
  renderLearnerLoadingState(subjectsContainer);

  // Fetch subjects from API
  fetchLearnerSubjects().then((subjects) => {
    subjectsContainer.innerHTML = '';
    if (subjects.length === 0) {
      renderLearnerEmptyState(subjectsContainer);
    } else {
      renderSubjectCards(subjectsContainer, subjects);
    }
  }).catch(() => {
    subjectsContainer.innerHTML = '';
    renderLearnerEmptyState(subjectsContainer, true);
  });

  return content;
}

/** Subject icon mapping for the design system. */
const SUBJECT_ICONS: Record<string, string> = {
  Maths: '📐',
  Science: '🧪',
  Computers: '🖥',
  EVS: '🌿',
  Hindi: 'हि',
  English: '🅰',
  Kannada: 'ಅ',
};

/** Fetches enrolled subjects for the authenticated learner from the API. */
async function fetchLearnerSubjects(): Promise<Array<{ name: string; color: string }>> {
  const tokensRaw = localStorage.getItem('learnverse_tokens');
  let accessToken = '';
  if (tokensRaw) {
    try {
      const parsed = JSON.parse(tokensRaw);
      accessToken = parsed.accessToken || '';
    } catch {
      // Invalid token data
    }
  }

  const response = await fetch('/api/v1/learner/subjects', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

/** Renders a loading state for the learner dashboard. */
function renderLearnerLoadingState(container: HTMLElement): void {
  const loadingEl = document.createElement('div');
  Object.assign(loadingEl.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    border: '1px solid #E0D8EC',
  });
  loadingEl.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 0.75rem;">⏳</div>
    <div style="font-size: 1rem; font-weight: 600; color: #2C2341;">Loading subjects...</div>
    <div style="font-size: 0.8rem; color: #6B7280; margin-top: 0.25rem;">Fetching your enrolled subjects</div>
  `;
  container.appendChild(loadingEl);
}

/** Renders the empty state when no subjects are assigned. */
function renderLearnerEmptyState(container: HTMLElement, isError = false): void {
  const emptyState = document.createElement('div');
  Object.assign(emptyState.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    border: '1px solid #E0D8EC',
  });

  const emptyIcon = document.createElement('div');
  emptyIcon.textContent = '📚';
  Object.assign(emptyIcon.style, {
    fontSize: '3rem',
    marginBottom: '1rem',
  });
  emptyState.appendChild(emptyIcon);

  const emptyTitle = document.createElement('div');
  emptyTitle.textContent = 'No subjects or chapters added yet';
  Object.assign(emptyTitle.style, {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#2C2341',
    marginBottom: '0.5rem',
  });
  emptyState.appendChild(emptyTitle);

  const emptyDesc = document.createElement('div');
  emptyDesc.textContent = isError
    ? 'Could not connect to the server. Please try again later.'
    : 'Ask your parent to add content. Once subjects and chapters are added, they will appear here.';
  Object.assign(emptyDesc.style, {
    fontSize: '0.85rem',
    color: '#6B7280',
    marginBottom: '1rem',
  });
  emptyState.appendChild(emptyDesc);

  if (isError) {
    const errorNote = document.createElement('div');
    errorNote.textContent = '⚠️ API unavailable — showing offline state';
    Object.assign(errorNote.style, {
      fontSize: '0.75rem',
      color: '#9CA3AF',
      fontStyle: 'italic',
    });
    emptyState.appendChild(errorNote);
  }

  container.appendChild(emptyState);
}

/** Renders subject cards for the learner dashboard. */
function renderSubjectCards(
  container: HTMLElement,
  subjects: Array<{ name: string; color: string }>
): void {
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '1rem',
  });

  for (const subject of subjects) {
    const card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-label', `Open ${subject.name}`);
    Object.assign(card.style, {
      backgroundColor: '#FFFFFF',
      borderRadius: '14px',
      padding: '1.25rem 1rem',
      textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
      border: `2px solid ${subject.color}`,
      cursor: 'pointer',
      transition: 'transform 0.15s, box-shadow 0.15s',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    });

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = `0 4px 16px ${subject.color}33`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.06)';
    });
    card.addEventListener('click', () => {
      window.location.hash = `#subject-${subject.name.toLowerCase()}`;
    });

    // Icon
    const icon = document.createElement('div');
    icon.textContent = SUBJECT_ICONS[subject.name] || '📘';
    Object.assign(icon.style, {
      fontSize: '2rem',
      width: '48px',
      height: '48px',
      lineHeight: '48px',
      borderRadius: '50%',
      backgroundColor: `${subject.color}18`,
    });
    card.appendChild(icon);

    // Name
    const nameEl = document.createElement('div');
    nameEl.textContent = subject.name;
    Object.assign(nameEl.style, {
      fontSize: '0.95rem',
      fontWeight: '700',
      color: '#2C2341',
    });
    card.appendChild(nameEl);

    // Progress indicator (placeholder)
    const progressEl = document.createElement('div');
    progressEl.textContent = '0% complete';
    Object.assign(progressEl.style, {
      fontSize: '0.7rem',
      color: '#9CA3AF',
    });
    card.appendChild(progressEl);

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  createRouter({
    mountPoint: app,
    routes: [
      {
        pattern: /^$/,
        handler: () => createLandingView(),
      },
      {
        pattern: /^login$/,
        handler: () => {
          // Clear stale tokens on login page to prevent CORS errors from token refresh
          clearTokens();
          return createLoginView();
        },
      },
      {
        pattern: /^register$/,
        handler: () => {
          clearTokens();
          return createParentRegistrationView();
        },
      },
      {
        pattern: /^add-learner$/,
        handler: () => createStudentRegistrationView(),
      },
      {
        pattern: /^forgot-password$/,
        handler: () => createForgotPasswordView(),
      },
      {
        pattern: /^reset-password/,
        handler: (params) => createResetPasswordView(params.token || ''),
      },
      {
        pattern: /^dashboard$/,
        handler: () => {
          // Parent Dashboard: empty tree sidebar until API data is loaded
          const parentTreeProps: TreeSidebarProps = {
            title: '👨‍👩‍👧 Learners',
            nodes: [],
            onNodeClick: (nodeId: string) => {
              console.log('Parent tree node clicked:', nodeId);
            },
          };
          return wrapInResponsiveLayout(createDashboardContent(), '#dashboard', parentTreeProps);
        },
      },
      {
        pattern: /^learner-dashboard$/,
        handler: () => {
          // Learner Dashboard: empty tree sidebar until API data is loaded
          const learnerTreeProps: TreeSidebarProps = {
            title: '📚 My Subjects',
            nodes: [],
            onNodeClick: (nodeId: string) => {
              console.log('Learner tree node clicked:', nodeId);
            },
          };
          return wrapInResponsiveLayout(
            createLearnerDashboardContent(),
            '#learner-dashboard',
            learnerTreeProps
          );
        },
      },
      {
        pattern: /^subjects$/,
        handler: () => {
          window.location.hash = '#learner-dashboard';
          return wrapInResponsiveLayout(createLoadingView('Loading subjects...'), '#subjects');
        },
      },
      {
        pattern: /^revision$/,
        handler: () => {
          const content = document.createElement('div');
          content.className = 'revision-landing-view';
          Object.assign(content.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 2rem',
            minHeight: '300px',
            backgroundColor: '#F8F5FF',
            borderRadius: '14px',
            border: '1px solid #E0D8EC',
            textAlign: 'center',
            margin: '1.5rem',
          });

          const icon = document.createElement('div');
          icon.textContent = '📝';
          icon.style.fontSize = '3rem';
          icon.style.marginBottom = '1rem';
          content.appendChild(icon);

          const title = document.createElement('h2');
          title.textContent = 'Revision';
          Object.assign(title.style, { fontSize: '1.3rem', fontWeight: '700', color: '#2C2341', marginBottom: '0.75rem' });
          content.appendChild(title);

          const description = document.createElement('p');
          description.textContent = 'Revision questions are generated per chapter. Open a chapter explanation and tap "Generate Revision Questions" to create a revision session.';
          Object.assign(description.style, { fontSize: '0.9rem', color: '#6B7280', maxWidth: '400px', lineHeight: '1.5' });
          content.appendChild(description);

          const startBtn = document.createElement('button');
          startBtn.type = 'button';
          startBtn.textContent = 'Browse Chapters';
          Object.assign(startBtn.style, {
            marginTop: '1.5rem',
            padding: '0.7rem 1.8rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#FFFFFF',
            backgroundColor: '#7C3AED',
            border: 'none',
            borderRadius: '22px',
            cursor: 'pointer',
          });
          startBtn.addEventListener('click', () => {
            window.location.hash = '#scan';
          });
          content.appendChild(startBtn);

          return wrapInResponsiveLayout(content, '#revision');
        },
      },
      {
        pattern: /^progress$/,
        handler: () => {
          const wrapper = document.createElement('div');
          wrapper.className = 'async-route-wrapper';

          // Show loading initially
          wrapper.appendChild(
            wrapInResponsiveLayout(createLoadingView('Loading progress...'), '#progress')
          );

          // Extract studentId from the JWT access token (for default streak display only)
          const studentId = getStudentIdFromToken() || 'unknown';

          // Fetch progress and streak data (streak has no backend endpoint yet, so handle gracefully)
          const defaultStreak: Streak = { studentId: studentId, currentStreak: 0, lastActivityDate: null };
          Promise.all([
            progressApi.getProgress(),
            progressApi.getStreak().catch(() => defaultStreak),
          ])
            .then(([progress, streak]) => {
              wrapper.innerHTML = '';
              const progressView = createProgressView({ progress, streak });
              wrapper.appendChild(
                wrapInResponsiveLayout(progressView, '#progress')
              );
            })
            .catch((err: unknown) => {
              const error = err as { status?: number; message?: string } | null;

              if (error?.status === 401) {
                clearTokens();
                window.location.hash = '#login';
                return;
              }

              wrapper.innerHTML = '';
              const errorMessage = error?.message || 'Failed to load progress data. Please try again.';
              const errorEl = createErrorView(errorMessage, () => {
                // Retry by re-navigating to the same route
                wrapper.innerHTML = '';
                wrapper.appendChild(
                  wrapInResponsiveLayout(createLoadingView('Loading progress...'), '#progress')
                );
                Promise.all([
                  progressApi.getProgress(),
                  progressApi.getStreak().catch(() => defaultStreak),
                ])
                  .then(([progress, streak]) => {
                    wrapper.innerHTML = '';
                    const progressView = createProgressView({ progress, streak });
                    wrapper.appendChild(
                      wrapInResponsiveLayout(progressView, '#progress')
                    );
                  })
                  .catch(() => {
                    // On repeated failure, redirect to re-trigger the route cleanly
                    window.location.hash = '#progress';
                  });
              });
              wrapper.appendChild(
                wrapInResponsiveLayout(errorEl, '#progress')
              );
            });

          return wrapper;
        },
      },
      {
        pattern: /^(scan|ingest)$/,
        handler: () => {
          return createAsyncRouteContainer(
            '#scan',
            async () => {
              const subjects = await contentApi.getSubjects();
              return createElement(ContentIngestionScreen, {
                subjects,
                fetchBooks: (subjectId: string) => contentApi.getBooks(subjectId),
                createBook: (subjectId: string, name: string) => contentApi.createBook(subjectId, name),
                fetchChapters: (bookId: string) => contentApi.getChapters(bookId),
                createChapter: (bookId: string, name: string) => contentApi.createChapter(bookId, name),
                onChapterSelect: (chapterId: string) => {
                  window.location.hash = `#upload/${chapterId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^upload\/(?<chapterId>[^/]+)$/,
        handler: (params) => {
          const chapterId = params.chapterId || '';
          return createAsyncRouteContainer(
            `#upload/${chapterId}`,
            async () => {
              return createElement(PageUploadUI, {
                chapterId,
                onExtractText: async (id: string, files: File[]) => {
                  await ingestionApi.uploadPages(id, files);
                  await ingestionApi.extractText(id);
                  window.location.hash = `#transcript/${id}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^transcript\/(?<chapterId>[^/]+)$/,
        handler: (params) => {
          const chapterId = params.chapterId || '';
          return createAsyncRouteContainer(
            `#transcript/${chapterId}`,
            async () => {
              const pages = await ingestionApi.getTranscript(chapterId);
              return createElement(ChapterTranscript, {
                pages,
                onSaveTranscript: async (pageData: { pageNumber: number; extractedText: string }[]) => {
                  await ingestionApi.saveTranscript(
                    chapterId,
                    pageData.map((p) => ({ pageNumber: p.pageNumber, text: p.extractedText }))
                  );
                },
              });
            }
          );
        },
      },
      {
        pattern: /^explain\/(?<chapterId>[^/]+)$/,
        handler: (params) => {
          const chapterId = params.chapterId || '';
          return createAsyncRouteContainer(
            `#explain/${chapterId}`,
            async () => {
              const pages = await ingestionApi.getTranscript(chapterId);
              const originalTexts: Record<number, string> = {};
              for (const page of pages) {
                originalTexts[page.pageNumber] = page.extractedText || '';
              }
              return createElement(ChapterExplanationScreen, {
                chapterId,
                originalTexts,
                totalPages: pages.length,
                fetchExplanation: async (id: string, page: number) => {
                  const explanation = await comprehensionApi.getExplanation(id, page);
                  return { explanation, cached: true, totalPages: pages.length };
                },
                generateAudio: async (id: string) => {
                  const result = await comprehensionApi.generateAudio(id, 1);
                  return { audioUrl: result.audioCdnUrl, s3Key: '' };
                },
                generateRevisionQuestions: async (id: string) => {
                  await comprehensionApi.generateRevisionQuestions(id);
                  window.location.hash = `#revision/${id}`;
                },
                fetchRevisionQuestions: async (id: string) => {
                  const questions = await comprehensionApi.getRevisionQuestions(id);
                  return questions.length > 0 ? { questions } : null;
                },
                generateSummary: (id: string) => comprehensionApi.generateSummary(id),
                fetchSummary: async (id: string) => {
                  try {
                    return await comprehensionApi.getSummary(id);
                  } catch {
                    return null;
                  }
                },
                translateExplanation: async (id: string, targetLanguage, page: number) => {
                  const result = await comprehensionApi.translate(id, targetLanguage, page);
                  return result.translatedText;
                },
                onNavigateToRevision: (id: string) => {
                  window.location.hash = `#revision/${id}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^exercises\/(?<chapterId>[^/]+)$/,
        handler: (params) => {
          const chapterId = params.chapterId || '';
          return createAsyncRouteContainer(
            `#exercises/${chapterId}`,
            async () => {
              const result = await contentApi.getExercises({ chapterId });
              const exercises = result.data.map((ex) => ({
                id: ex.id,
                questionText: (ex.content as { questionText?: string }).questionText || '',
                exerciseType: ex.exerciseType as ExerciseItemType,
                options: (ex.content as { options?: string[] }).options,
                sequenceNumber: ex.sequenceNumber,
              }));
              return createElement(ExerciseAssistant, {
                chapterId,
                exercises,
                fetchHint: async (exerciseId: string) => {
                  const hint = await comprehensionApi.getHint(exerciseId);
                  return {
                    hint: hint.hint,
                    referencedSections: hint.chapterReference ? [hint.chapterReference] : [],
                  };
                },
                evaluateAnswer: async (exerciseId: string, answer: string) => {
                  const evalResult = await comprehensionApi.evaluate(exerciseId, answer);
                  return {
                    isCorrect: evalResult.isCorrect,
                    score: evalResult.score,
                    feedback: evalResult.feedback,
                    referencedSection: evalResult.chapterReference,
                  };
                },
                onBack: () => {
                  window.location.hash = `#explain/${chapterId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^pronunciation\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#pronunciation/${subjectId}`,
            async () => {
              const word = await pronunciationApi.getReferenceAudio(subjectId);
              return createElement(PronunciationScreen, {
                word,
                fetchReferenceAudio: (wordId: string) =>
                  pronunciationApi.getReferenceAudio(wordId).then(w => ({ audioUrl: w.referenceAudioUrl })),
                submitRecording: (wordId: string, audioBlob: Blob) =>
                  pronunciationApi.uploadRecording(audioBlob, wordId, subjectId),
                onNext: () => {
                  window.location.hash = `#pronunciation/${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^grammar\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#grammar/${subjectId}`,
            async () => {
              return createElement(GrammarExerciseScreen, {
                fetchExercises: () =>
                  contentApi.getExercises({ subjectId, exerciseType: 'grammar' }).then(result => ({
                    id: result.data[0]?.id || subjectId,
                    subjectId,
                    questions: result.data.map(ex => ({
                      id: ex.id,
                      sentence: (ex.content as any).sentence || '',
                      options: (ex.content as any).options || [],
                      sequenceNumber: ex.sequenceNumber,
                    })),
                  })),
                validateAnswer: (exerciseId: string, questionId: string, selectedOption: string) =>
                  comprehensionApi.evaluate(questionId, selectedOption).then(r => ({
                    isCorrect: r.isCorrect,
                    correctAnswer: r.feedback || '',
                    feedback: r.feedback,
                    grammarRule: '',
                  })),
                onBack: () => {
                  window.location.hash = `#subject-${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^quiz\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#quiz/${subjectId}`,
            async () => {
              return createElement(QuizScreen, {
                createSession: () =>
                  progressApi.createQuizSession({ subjectId, questionIds: [], timerDurationSeconds: 300 }).then(session => ({
                    id: session.id,
                    questions: (session as any).questions || [],
                    timerDurationSeconds: session.timerDurationSeconds || 300,
                    totalQuestions: session.totalQuestions || 0,
                  })),
                submitAnswer: (sessionId: string, questionId: string, selectedOption: string) =>
                  progressApi.submitQuizAnswer(sessionId, { questionId, selectedOption }).then(r => ({
                    isCorrect: r.isCorrect,
                    runningScore: 0,
                    answeredCount: 0,
                    correctCount: 0,
                  })),
                skipQuestion: (sessionId: string, questionId: string) =>
                  progressApi.skipQuizQuestion(sessionId, { questionId }),
                getResult: (sessionId: string) =>
                  progressApi.getQuizResult(sessionId).then(session => ({
                    totalQuestions: session.totalQuestions || 0,
                    correctAnswers: session.correctAnswers || 0,
                    scorePercentage: session.scorePercentage || 0,
                    timeTakenSeconds: (session as any).timeTakenSeconds || 0,
                  })),
                onComplete: () => { /* allow viewing progress */ },
                onNavigateAway: () => {
                  window.location.hash = `#subject-${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^maths\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#maths/${subjectId}`,
            async () => {
              return createElement(MathsPracticeScreen, {
                fetchExercises: () =>
                  contentApi.getExercises({ subjectId, exerciseType: 'maths' }).then(result => ({
                    id: result.data[0]?.id || subjectId,
                    subjectId,
                    questions: result.data.map(ex => ({
                      id: ex.id,
                      numerator: (ex.content as any).numerator || 1,
                      denominator: (ex.content as any).denominator || 2,
                      shapeType: (ex.content as any).shapeType || 'circle',
                      sequenceNumber: ex.sequenceNumber,
                    })),
                  })),
                checkAnswer: (exerciseId: string, questionId: string, numerator: number, denominator: number) =>
                  comprehensionApi.evaluate(questionId, { numerator, denominator }).then(r => ({
                    isCorrect: r.isCorrect,
                    hint: r.isCorrect ? undefined : { wrongPart: 'both' as const },
                  })),
                onBack: () => {
                  window.location.hash = `#subject-${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^computers\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#computers/${subjectId}`,
            async () => {
              return createElement(ComputersExerciseScreen, {
                fetchExercise: () =>
                  contentApi.getExercises({ subjectId, exerciseType: 'computers' }).then(result => {
                    const ex = result.data[0];
                    return {
                      id: ex?.id || '',
                      subjectId,
                      codeSnippet: (ex?.content as any)?.codeSnippet || { language: 'javascript', code: '' },
                      pairs: (ex?.content as any)?.pairs || [],
                    };
                  }),
                onValidateMatches: (exerciseId: string, matches: Record<string, string>) =>
                  comprehensionApi.evaluate(exerciseId, matches).then(r =>
                    Object.keys(matches).map(key => ({ pairId: key, isCorrect: r.isCorrect }))
                  ),
                onBack: () => {
                  window.location.hash = `#subject-${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^evs\/(?<subjectId>[^/]+)$/,
        handler: (params) => {
          const subjectId = params.subjectId || '';
          return createAsyncRouteContainer(
            `#evs/${subjectId}`,
            async () => {
              return createElement(EVSVisualizationScreen, {
                fetchExerciseData: () =>
                  contentApi.getExercises({ subjectId, exerciseType: 'evs' }).then(result => {
                    const ex = result.data[0];
                    return {
                      visualization: (ex?.content as any)?.visualization || { id: '', title: '', stages: [] },
                      quizQuestions: (ex?.content as any)?.quizQuestions || [],
                    };
                  }),
                validateOrder: (visualizationId: string, stageIds: string[]) =>
                  comprehensionApi.evaluate(visualizationId, { stageIds }).then(r => ({
                    perItemCorrectness: stageIds.map(() => r.isCorrect),
                    allCorrect: r.isCorrect,
                  })),
                onBack: () => {
                  window.location.hash = `#subject-${subjectId}`;
                },
              });
            }
          );
        },
      },
      {
        pattern: /^subject-(?<subjectName>[^/]+)$/,
        handler: (params) => {
          const subjectName = decodeURIComponent(params.subjectName || '');
          const wrapper = document.createElement('div');
          wrapper.className = 'async-route-wrapper';

          // Show loading initially
          wrapper.appendChild(
            wrapInResponsiveLayout(createLoadingView('Loading subject...'), `#subject-${subjectName}`)
          );

          // Fetch subjects to resolve name → metadata
          const studentId = getStudentIdFromToken();

          Promise.all([
            contentApi.getSubjects(),
            studentId ? progressApi.getProgress() : Promise.resolve([]),
          ])
            .then(([subjects, progressData]) => {
              const subject = subjects.find(
                (s) => s.subjectName.toLowerCase() === subjectName.toLowerCase()
              );

              if (!subject) {
                wrapper.innerHTML = '';
                const errorEl = createErrorView(
                  `Subject "${subjectName}" not found.`,
                  () => { window.location.hash = '#learner-dashboard'; }
                );
                wrapper.appendChild(
                  wrapInResponsiveLayout(errorEl, `#subject-${subjectName}`)
                );
                return;
              }

              // Resolve progress percentage for this subject
              const subjectProgress = progressData.find(
                (p) => p.subjectId === subject.subjectId
              );
              const progressPercent = subjectProgress?.progressPercentage ?? 0;

              // Resolve icon from the SUBJECT_ICONS map
              const icon = SUBJECT_ICONS[subject.subjectName] || '📘';

              wrapper.innerHTML = '';
              const view = createSubjectLandingView(
                subject.subjectName,
                subject.subjectId,
                subject.color,
                icon,
                progressPercent
              );
              wrapper.appendChild(
                wrapInResponsiveLayout(view, `#subject-${subjectName}`)
              );
            })
            .catch((err: unknown) => {
              const error = err as { status?: number; message?: string } | null;

              if (error?.status === 401) {
                clearTokens();
                window.location.hash = '#login';
                return;
              }

              wrapper.innerHTML = '';
              const errorMessage = error?.message || 'Failed to load subject data. Please try again.';
              const errorEl = createErrorView(errorMessage, () => {
                // Retry: re-navigate to same route
                window.location.hash = `#subject-${subjectName}`;
              });
              wrapper.appendChild(
                wrapInResponsiveLayout(errorEl, `#subject-${subjectName}`)
              );
            });

          return wrapper;
        },
      },
      {
        pattern: /^edit-subjects\/(?<learnerId>[^/]+)$/,
        handler: (params) => {
          const learnerId = params.learnerId || '';
          return createAsyncRouteContainer(
            `#edit-subjects/${learnerId}`,
            async () => {
              const learners = await parentApi.getLearners();
              const learner = learners.find((l) => l.id === learnerId);
              const allSubjectNames = Array.from(
                new Set(learners.flatMap((l) => l.subjects))
              );
              // Provide a default list if no subjects found across learners
              const availableSubjects = allSubjectNames.length > 0
                ? allSubjectNames
                : ['Maths', 'Science', 'Computers', 'EVS', 'Hindi', 'English', 'Kannada'];

              return createElement(ParentDashboard, {
                learners: learner ? [learner] : learners,
                availableSubjects,
                onRegisterStudent: () => {
                  window.location.hash = '#add-learner';
                },
                onUpdateSubjects: async (id: string, subjects: string[]) => {
                  await parentApi.updateLearnerSubjects(id, subjects);
                  window.location.hash = '#dashboard';
                },
              });
            }
          );
        },
      },
      {
        pattern: /^me$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Me'), '#me'),
      },
    ],
    fallback: () => createLandingView(),
  });
}

document.addEventListener('DOMContentLoaded', initApp);
