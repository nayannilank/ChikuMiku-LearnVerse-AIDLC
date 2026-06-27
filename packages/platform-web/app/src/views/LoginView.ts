/**
 * LoginView — Two-panel login page for the LearnVerse web application.
 *
 * Composes a minimal auth header, BrandingPanel, and LoginPanel into a
 * full-page layout with background color #F8F5FF. Wires login submission to
 * AuthService.loginWithRole, forgot password to hash navigation (#forgot-password),
 * and successful login to hash navigation (#dashboard).
 *
 * The auth header only shows the logo and a Register link — authenticated
 * navigation items (Dashboard, Subjects, etc.) are NOT shown on this screen.
 *
 * Usage:
 *   import { createLoginView } from './views/LoginView';
 *   document.getElementById('app')!.appendChild(createLoginView());
 *
 * Validates: Requirements 1.9, 2.1, 2.2, 2.7, 3.10
 */

import { createHeaderLogo } from '../components/HeaderLogo';
import { createBrandingPanel } from '../components/BrandingPanel';
import { createLoginPanel } from '../components/LoginPanel';
import { loginWithRole } from '../services/AuthService';
import type { UserRole } from '../types/auth';
import '../styles/login-view.css';

/**
 * Creates a minimal auth header with logo and Register link.
 * This is NOT the full authenticated TopNavigation — it only shows
 * branding and an optional registration link for unauthenticated users.
 */
function createAuthHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'login-view__header';
  header.setAttribute('aria-label', 'Site header');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '56px',
    padding: '0 24px',
    backgroundColor: '#2C2341',
    boxSizing: 'border-box',
    flexShrink: '0',
  });

  // Logo on the left
  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 36,
    altText: 'ChikuMiku LearnVerse',
  });
  header.appendChild(logo);

  // Register link on the right
  const registerLink = document.createElement('a');
  registerLink.className = 'login-view__register-link';
  registerLink.textContent = 'Register';
  registerLink.href = '#register';
  registerLink.setAttribute('role', 'link');
  Object.assign(registerLink.style, {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    transition: 'background-color 0.2s, border-color 0.2s',
    cursor: 'pointer',
  });

  registerLink.addEventListener('mouseenter', () => {
    registerLink.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    registerLink.style.borderColor = 'rgba(255, 255, 255, 0.7)';
  });
  registerLink.addEventListener('mouseleave', () => {
    registerLink.style.backgroundColor = 'transparent';
    registerLink.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });

  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#register';
  });

  header.appendChild(registerLink);

  return header;
}

/**
 * Creates the complete login view element with two-panel layout.
 *
 * The returned element contains:
 * - A minimal auth header with logo and Register link (no authenticated nav)
 * - A two-panel content area:
 *   - BrandingPanel (left) with title, subtitle, badges, and watermark
 *   - LoginPanel (right) with role tabs, form fields, and submit button
 *
 * @returns An HTMLElement representing the full login page.
 */
export function createLoginView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'login-view';

  // Minimal auth header (logo + Register link only, no authenticated nav)
  const header = createAuthHeader();
  container.appendChild(header);

  // Two-panel layout content area (Req 2.1: BrandingPanel left, LoginPanel right)
  const content = document.createElement('div');
  content.className = 'login-view__content';

  // BrandingPanel on the left (Req 2.1)
  const brandingPanel = createBrandingPanel();
  content.appendChild(brandingPanel);

  // Right panel wrapper — centers the login card (Req 2.1, 2.6)
  const rightPanel = document.createElement('div');
  rightPanel.className = 'login-panel';

  // LoginPanel card on the right (Req 2.1, 3.10)
  const loginPanel = createLoginPanel({
    onSubmit: async (username: string, password: string, role: UserRole): Promise<void> => {
      const result = await loginWithRole(username, password, role);

      if (result.success) {
        // Store username (role-agnostic) and role for use across the app
        if (result.data?.username) {
          localStorage.setItem('learnverse_username', result.data.username);
          localStorage.setItem('learnverse_user_role', role);
        }
        // Role-based routing: parent → parent dashboard, learner → learner dashboard
        if (role === 'parent') {
          window.location.hash = '#dashboard';
        } else {
          window.location.hash = '#learner-dashboard';
        }
      } else {
        // Throw error so LoginPanel can display it in the error area
        throw new Error(result.error || 'Login failed. Please try again.');
      }
    },
    onForgotPassword: () => {
      // Navigate to forgot password screen
      window.location.hash = '#forgot-password';
    },
  });
  rightPanel.appendChild(loginPanel);
  content.appendChild(rightPanel);

  container.appendChild(content);

  return container;
}
