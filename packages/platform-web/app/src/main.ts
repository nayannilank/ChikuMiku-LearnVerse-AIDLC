import './styles/design-tokens.css';
import './styles/home.css';

import { createRouter } from './router/HashRouter';
import { createLoginView } from './views/LoginView';
import { createParentRegistrationView } from './views/ParentRegistrationView';
import { createForgotPasswordView } from './views/ForgotPasswordView';
import { createResetPasswordView } from './views/ResetPasswordView';
import { createResponsiveLayout } from './components/ResponsiveLayout';
import { SidebarSubject } from './components/Sidebar';

/** Sample subjects for the sidebar (Req 4.5). */
const DEFAULT_SUBJECTS: SidebarSubject[] = [
  { name: 'Kannada', color: '#9B59B6', progress: 45 },
  { name: 'English', color: '#5DADE2', progress: 72 },
  { name: 'Hindi', color: '#F7C948', progress: 30 },
  { name: 'Maths', color: '#E94F9B', progress: 60 },
  { name: 'Computers', color: '#4A6CF7', progress: 85 },
  { name: 'EVS', color: '#27AE60', progress: 50 },
  { name: 'Science', color: '#4ECDC4', progress: 40 },
];

/** Maps mobile tab IDs to hash routes for navigation. */
const MOBILE_TAB_ROUTES: Record<string, string> = {
  home: '#dashboard',
  chapters: '#subjects',
  scan: '#scan',
  revision: '#revision',
  me: '#me',
};

/** Maps hash routes to mobile tab IDs for highlighting. */
function getActiveMobileTab(hash: string): string {
  switch (hash) {
    case '#dashboard':
    case '':
      return 'home';
    case '#subjects':
      return 'chapters';
    case '#scan':
      return 'scan';
    case '#revision':
      return 'revision';
    case '#me':
    case '#progress':
      return 'me';
    default:
      return 'home';
  }
}

/**
 * Wraps a content element in the ResponsiveLayout shell.
 * Provides desktop NavigationShell (TopNav + Sidebar) at ≥960px
 * and mobile full-width + bottom nav at <960px.
 */
function wrapInResponsiveLayout(content: HTMLElement, activeRoute: string): HTMLElement {
  return createResponsiveLayout({
    onNavigate: (route: string) => {
      window.location.hash = route;
    },
    onLogout: () => {
      window.location.hash = '#';
    },
    activeRoute,
    userName: 'Student',
    subjects: DEFAULT_SUBJECTS,
    onSelectSubject: (subjectId: string) => {
      window.location.hash = `#subject-${subjectId.toLowerCase()}`;
    },
    content,
    onMobileTabPress: (tabId: string) => {
      const route = MOBILE_TAB_ROUTES[tabId] || '#dashboard';
      window.location.hash = route;
    },
    activeMobileTab: getActiveMobileTab(activeRoute),
  });
}

/** Creates the dashboard content (without navigation shell). */
function createDashboardContent(): HTMLElement {
  const content = document.createElement('div');
  content.className = 'dashboard-content';
  content.innerHTML = `
    <h1>Dashboard</h1>
    <p>Welcome to LearnVerse! Your learning journey starts here.</p>
  `;
  return content;
}

/** Creates a generic authenticated page placeholder. */
function createPagePlaceholder(title: string): HTMLElement {
  const content = document.createElement('div');
  content.className = 'page-content';
  content.innerHTML = `<h1>${title}</h1><p>This section is under construction.</p>`;
  return content;
}

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  createRouter({
    mountPoint: app,
    routes: [
      {
        pattern: /^$/,
        handler: () => createLoginView(),
      },
      {
        pattern: /^login$/,
        handler: () => createLoginView(),
      },
      {
        pattern: /^register$/,
        handler: () => createParentRegistrationView(),
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
        handler: () => wrapInResponsiveLayout(createDashboardContent(), '#dashboard'),
      },
      {
        pattern: /^subjects$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Subjects'), '#subjects'),
      },
      {
        pattern: /^revision$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Revision'), '#revision'),
      },
      {
        pattern: /^progress$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Progress'), '#progress'),
      },
      {
        pattern: /^scan$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Scan'), '#scan'),
      },
      {
        pattern: /^me$/,
        handler: () => wrapInResponsiveLayout(createPagePlaceholder('Me'), '#me'),
      },
    ],
    fallback: () => createLoginView(),
  });
}

document.addEventListener('DOMContentLoaded', initApp);
