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
