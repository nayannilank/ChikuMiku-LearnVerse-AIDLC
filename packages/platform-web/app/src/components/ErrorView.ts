/**
 * ErrorView — Shared error display component for the web platform.
 *
 * Creates an HTMLElement showing an error icon, message text, and an optional
 * "Retry" button. Uses design-system tokens for consistent styling across all
 * data-fetching routes.
 *
 * Design tokens:
 *   - Error red: #E74C3C
 *   - Background: #F8F5FF
 *   - Border: #E0D8EC
 *
 * Usage:
 *   import { createErrorView } from './components/ErrorView';
 *   const errorEl = createErrorView('Something went wrong.', () => refetch());
 *   container.appendChild(errorEl);
 *
 * Validates: Requirements 14.2, 14.4
 */

/**
 * Creates an error display with message and optional retry button.
 *
 * The returned element has `role="alert"` for accessibility, ensuring screen
 * readers announce the error to users. The retry button (when provided) uses
 * `aria-label="Retry loading"` for clarity.
 *
 * @param message - The error message to display. Defaults to a generic message.
 * @param onRetry - Optional callback invoked when the user clicks the Retry button.
 * @returns An HTMLElement suitable for insertion into the page.
 */
export function createErrorView(
  message = 'Something went wrong. Please try again.',
  onRetry?: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'error-view';
  container.setAttribute('role', 'alert');
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem 2rem',
    backgroundColor: '#F8F5FF',
    borderRadius: '14px',
    border: '1px solid #E0D8EC',
    textAlign: 'center',
  });

  // Error icon
  const icon = document.createElement('div');
  icon.textContent = '⚠️';
  icon.style.fontSize = '2.5rem';
  container.appendChild(icon);

  // Message
  const msg = document.createElement('p');
  msg.textContent = message;
  Object.assign(msg.style, {
    marginTop: '1rem',
    fontSize: '0.95rem',
    color: '#E74C3C',
    fontWeight: '600',
  });
  container.appendChild(msg);

  // Retry button (conditional)
  if (onRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Retry';
    btn.setAttribute('aria-label', 'Retry loading');
    Object.assign(btn.style, {
      marginTop: '1.5rem',
      padding: '0.6rem 1.5rem',
      fontSize: '0.85rem',
      fontWeight: '600',
      color: '#FFFFFF',
      backgroundColor: '#E94F9B',
      border: 'none',
      borderRadius: '22px',
      cursor: 'pointer',
    });
    btn.addEventListener('click', onRetry);
    container.appendChild(btn);
  }

  return container;
}
