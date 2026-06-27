/**
 * LoadingView — Shared loading indicator component for the web platform.
 *
 * Creates an HTMLElement displaying a centered loading spinner with an optional
 * message. Uses design-system tokens for consistent styling across all
 * data-fetching routes.
 *
 * Design tokens:
 *   - Background: #F8F5FF
 *   - Border: #E0D8EC
 *   - Spinner accent: #E94F9B
 *
 * Accessibility:
 *   - role="status" announces loading state to assistive technologies
 *   - aria-live="polite" provides non-intrusive screen reader updates
 *
 * Usage:
 *   import { createLoadingView } from './components/LoadingView';
 *   container.appendChild(createLoadingView('Fetching data...'));
 *
 * Validates: Requirements 14.1, 14.4
 */

/**
 * Creates a centered loading indicator element using design-system tokens.
 * Background: #F8F5FF, spinner accent: #E94F9B, border: #E0D8EC
 *
 * @param message - Optional loading message displayed below the spinner. Defaults to 'Loading...'.
 * @returns An HTMLElement suitable for insertion as a loading state indicator.
 */
export function createLoadingView(message = 'Loading...'): HTMLElement {
  const container = document.createElement('div');
  container.className = 'loading-view';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    minHeight: '200px',
    backgroundColor: '#F8F5FF',
    borderRadius: '14px',
    border: '1px solid #E0D8EC',
  });

  // Spinner element — CSS animation defined in design-tokens.css
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  Object.assign(spinner.style, {
    width: '36px',
    height: '36px',
    border: '4px solid #E0D8EC',
    borderTopColor: '#E94F9B',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  });
  container.appendChild(spinner);

  // Message text
  const msg = document.createElement('p');
  msg.textContent = message;
  Object.assign(msg.style, {
    marginTop: '1rem',
    fontSize: '0.9rem',
    color: '#6B7280',
    fontWeight: '500',
  });
  container.appendChild(msg);

  return container;
}
