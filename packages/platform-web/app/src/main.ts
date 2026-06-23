import './styles/home.css';

import { createRouter } from './router/HashRouter';
import { createLoginView } from './views/LoginView';
import { createRegistrationView } from './views/RegistrationView';
import { createForgotPasswordView } from './views/ForgotPasswordView';
import { createResetPasswordView } from './views/ResetPasswordView';
import { createAuthenticatedHeader } from './components/Header';

function createDashboardPlaceholder(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'dashboard-view';

  // Authenticated header at top (Req 2.1, 2.2, 2.3, 2.4)
  const header = createAuthenticatedHeader({
    onHomeClick: () => {
      window.location.hash = '#';
    },
    onLogoutClick: () => {
      window.location.hash = '#';
    },
  });
  container.appendChild(header);

  // Existing dashboard content below header
  const content = document.createElement('div');
  content.className = 'dashboard-content';
  content.innerHTML = `
    <h1>Dashboard</h1>
    <p>Welcome to LearnVerse! Your learning journey starts here.</p>
  `;
  container.appendChild(content);

  return container;
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
        handler: () => createRegistrationView(),
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
        handler: () => createDashboardPlaceholder(),
      },
    ],
    fallback: () => createLoginView(),
  });
}

document.addEventListener('DOMContentLoaded', initApp);
