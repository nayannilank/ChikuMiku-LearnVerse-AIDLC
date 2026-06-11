/**
 * HomeView — Assembles the home page for the LearnVerse web application.
 *
 * Composes Header, BackgroundWatermark, RoleSelector, and LoginForm into a
 * single self-contained page element. The flow is:
 *   1. User sees the RoleSelector (Parent / Student)
 *   2. After selecting a role, the LoginForm appears
 *   3. On login failure, LoginForm shows error + failure actions
 *   4. On login success, a welcome card replaces the main content
 *
 * Usage:
 *   import { createHomeView } from './views/HomeView';
 *   document.getElementById('app')!.appendChild(createHomeView());
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7, 1.8
 */

import { createHeader } from '../components/Header';
import { createBackgroundWatermark } from '../components/BackgroundWatermark';
import { createRoleSelector } from '../components/RoleSelector';
import { createLoginForm } from '../components/LoginForm';
import { loginWithRole } from '../services/AuthService';
import type { UserRole } from '../types/auth';

/**
 * Creates the complete home page view element.
 *
 * The returned element contains:
 * - A header with logo and register button
 * - A decorative background watermark
 * - A main content area starting with the RoleSelector, transitioning to
 *   the LoginForm once a role is chosen
 *
 * @returns An HTMLElement representing the full home page.
 */
export function createHomeView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'home-view';

  // Header with register navigation (Req 1.7)
  const header = createHeader({
    onRegisterClick: () => {
      window.location.hash = '#register';
    },
  });
  container.appendChild(header);

  // Background watermark (decorative)
  const watermark = createBackgroundWatermark();
  container.appendChild(watermark);

  // Main content area
  const main = document.createElement('div');
  main.className = 'main-content';

  // Login form area — will be populated after role selection
  const loginArea = document.createElement('div');
  loginArea.className = 'home-view__login-area';

  // Role selector (Req 1.1)
  const roleSelector = createRoleSelector({
    onRoleSelected: (role: UserRole) => {
      // Clear previous login form if role changes (Req 1.2)
      loginArea.innerHTML = '';

      const loginForm = createLoginForm({
        role,
        onSubmit: async (username: string, password: string, selectedRole: UserRole): Promise<void> => {
          const result = await loginWithRole(username, password, selectedRole);

          if (result.success) {
            // Successful login — show welcome card
            main.innerHTML = '';
            const welcomeCard = document.createElement('div');
            welcomeCard.className = 'welcome-card';
            welcomeCard.innerHTML = `
              <h2>Welcome!</h2>
              <p>You are logged in as <strong>${result.data?.username ?? username}</strong>.</p>
            `;
            main.appendChild(welcomeCard);
          } else {
            // Login failed — throw so LoginForm shows error + failure actions (Req 1.5, 1.6)
            throw new Error(result.error || 'Login failed. Please try again.');
          }
        },
        onForgotPassword: () => {
          // Req 1.8
          window.location.hash = '#forgot-password';
        },
        onRegister: () => {
          // Req 1.7
          window.location.hash = '#register';
        },
      });

      loginArea.appendChild(loginForm);
    },
  });

  main.appendChild(roleSelector);
  main.appendChild(loginArea);
  container.appendChild(main);

  return container;
}
