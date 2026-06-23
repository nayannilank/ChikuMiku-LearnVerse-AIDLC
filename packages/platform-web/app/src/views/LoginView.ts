/**
 * LoginView — Two-panel login page for the LearnVerse web application.
 *
 * Composes TopNavBar, BrandingPanel, and LoginPanel into a full-page layout
 * with background color #F8F5FF. Wires login submission to AuthService.loginWithRole,
 * forgot password to hash navigation (#forgot-password), and successful login
 * to hash navigation (#dashboard).
 *
 * Usage:
 *   import { createLoginView } from './views/LoginView';
 *   document.getElementById('app')!.appendChild(createLoginView());
 *
 * Validates: Requirements 1.9, 2.1, 2.2, 2.7, 3.10
 */

import { createTopNavBar } from '../components/TopNavBar';
import { createBrandingPanel } from '../components/BrandingPanel';
import { createLoginPanel } from '../components/LoginPanel';
import { loginWithRole } from '../services/AuthService';
import type { UserRole } from '../types/auth';
import '../styles/login-view.css';

/**
 * Creates the complete login view element with two-panel layout.
 *
 * The returned element contains:
 * - TopNavBar at the top with hash-based navigation
 * - A two-panel content area:
 *   - BrandingPanel (left) with title, subtitle, badges, and watermark
 *   - LoginPanel (right) with role tabs, form fields, and submit button
 *
 * @returns An HTMLElement representing the full login page.
 */
export function createLoginView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'login-view';
  container.style.backgroundColor = '#F8F5FF';
  container.style.minHeight = '100vh';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  // TopNavBar at top (Req 1.9: identical on Login and Registration screens)
  const navBar = createTopNavBar({
    onNavigate: (route: string) => {
      window.location.hash = route;
    },
  });
  container.appendChild(navBar);

  // Two-panel layout content area (Req 2.1: BrandingPanel left, LoginPanel right)
  const content = document.createElement('div');
  content.className = 'login-view__content';
  Object.assign(content.style, {
    display: 'flex',
    flexDirection: 'row',
    flex: '1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    gap: '2rem',
  });

  // BrandingPanel on the left (Req 2.1)
  const brandingPanel = createBrandingPanel();
  content.appendChild(brandingPanel);

  // LoginPanel on the right (Req 2.1, 3.10)
  const loginPanel = createLoginPanel({
    onSubmit: async (username: string, password: string, role: UserRole): Promise<void> => {
      const result = await loginWithRole(username, password, role);

      if (result.success) {
        // Navigate to dashboard on successful login (Req 2.7 equivalent)
        window.location.hash = '#dashboard';
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
  content.appendChild(loginPanel);

  container.appendChild(content);

  return container;
}
