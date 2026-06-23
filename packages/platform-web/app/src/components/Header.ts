/**
 * Header — Framework-agnostic header component for the web platform.
 *
 * Creates an HTMLElement displaying a flex header with the ChikuMiku LearnVerse
 * logo on the left and a styled register button on the right. The register
 * button invokes a provided callback when clicked.
 *
 * Usage:
 *   import { createHeader } from './components/Header';
 *   document.body.appendChild(createHeader({ onRegisterClick: () => { ... } }));
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 3.1, 3.2, 3.3
 */

import { createHeaderLogo } from './HeaderLogo';

/**
 * Configuration options for the header component.
 */
export interface HeaderOptions {
  /** Callback invoked when the register button is clicked. */
  onRegisterClick: () => void;
}

/**
 * Configuration options for the authenticated header component.
 */
export interface AuthenticatedHeaderOptions {
  /** Callback invoked when the logout button is clicked. */
  onLogoutClick: () => void;
  /** Callback invoked when the home button is clicked. */
  onHomeClick: () => void;
}

/**
 * Creates a header DOM element with logo and register button.
 *
 * The returned element is a flex container using the `home-header` CSS class.
 * It renders `createHeaderLogo` on the left with the ChikuMiku LearnVerse logo
 * and a styled register button on the right that invokes `onRegisterClick`.
 *
 * @param options - Configuration with `onRegisterClick` callback.
 * @returns An HTMLElement suitable for insertion at the top of the page.
 */
export function createHeader(options: HeaderOptions): HTMLElement {
  const header = document.createElement('header');
  header.className = 'home-header';

  // Logo on the left (Req 1.1, 1.2, 1.3)
  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 40,
  });
  header.appendChild(logo);

  // Register button on the right (Req 3.1, 3.2, 3.3)
  const registerBtn = document.createElement('button');
  registerBtn.type = 'button';
  registerBtn.className = 'register-btn';
  registerBtn.textContent = 'Register';
  registerBtn.addEventListener('click', options.onRegisterClick);
  header.appendChild(registerBtn);

  return header;
}

/**
 * Creates an authenticated header DOM element with logo, home button, and logout button.
 *
 * The returned element is a flex container using the `authenticated-header` CSS class.
 * It renders `createHeaderLogo` on the left with the ChikuMiku LearnVerse logo
 * and Home + Logout buttons on the right within a `.header-actions` container.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * @param options - Configuration with `onLogoutClick` and `onHomeClick` callbacks.
 * @returns An HTMLElement suitable for insertion at the top of authenticated pages.
 */
export function createAuthenticatedHeader(options: AuthenticatedHeaderOptions): HTMLElement {
  const header = document.createElement('header');
  header.className = 'authenticated-header';

  // Logo on the left (Req 2.1, 2.4)
  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 40,
  });
  header.appendChild(logo);

  // Action buttons on the right (Req 2.2, 2.3, 2.4)
  const actions = document.createElement('div');
  actions.className = 'header-actions';

  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'home-btn';
  homeBtn.textContent = 'Home';
  homeBtn.addEventListener('click', options.onHomeClick);
  actions.appendChild(homeBtn);

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', options.onLogoutClick);
  actions.appendChild(logoutBtn);

  header.appendChild(actions);

  return header;
}
