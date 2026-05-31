/**
 * HelpButton Web Component
 *
 * A fixed-position button rendered in the bottom-right corner of the viewport.
 * Displays a question mark icon with accessible labeling and triggers the
 * HelpViewerStateManager to open the help viewer on activation.
 *
 * Visibility is controlled by the `HelpButtonState` — the button only appears
 * on authenticated screens and hides when full-screen modals or system overlays
 * are active.
 *
 * Meets WCAG accessibility requirements:
 * - Minimum click target size of 44×44 CSS pixels
 * - Minimum 8px spacing from adjacent interactive elements
 * - Keyboard navigable (Tab) and activatable (Enter/Space)
 * - Accessible label "Help" for screen readers
 */

import type { HelpButtonConfig, HelpButtonState } from './types';
import { HelpViewerStateManager } from './stateManager';

/** Default configuration for the HelpButton */
const DEFAULT_CONFIG: HelpButtonConfig = {
  ariaLabel: 'Help',
  minTargetSize: 44,
  minSpacing: 8,
  position: { bottom: 16, right: 16 },
};

/**
 * Dependencies required by the HelpButton.
 * The state manager is injected to decouple the button from viewer lifecycle.
 */
export interface HelpButtonDependencies {
  stateManager: HelpViewerStateManager;
}

/**
 * HelpButton class manages its own DOM rendering and lifecycle.
 * It creates a fixed-position button element and attaches it to the document body.
 */
export class HelpButton {
  private readonly config: HelpButtonConfig;
  private readonly stateManager: HelpViewerStateManager;
  private buttonElement: HTMLButtonElement | null = null;
  private state: HelpButtonState = { isVisible: false, isHelpViewerOpen: false };

  constructor(deps: HelpButtonDependencies, config?: Partial<HelpButtonConfig>) {
    this.stateManager = deps.stateManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Render the help button and attach it to the DOM.
   * If already rendered, this is a no-op.
   */
  render(container: HTMLElement = document.body): HTMLButtonElement {
    if (this.buttonElement) {
      return this.buttonElement;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', this.config.ariaLabel);
    button.className = 'help-button';

    // Apply styles for fixed positioning and sizing
    this.applyStyles(button);

    // Set the question mark icon content
    button.innerHTML = this.getIconMarkup();

    // Wire click handler
    button.addEventListener('click', this.handleClick);

    // Wire keyboard activation (Enter and Space are handled natively by <button>,
    // but we add explicit handling for robustness)
    button.addEventListener('keydown', this.handleKeyDown);

    this.buttonElement = button;
    container.appendChild(button);

    // Apply initial visibility
    this.updateVisibility();

    return button;
  }

  /**
   * Remove the button from the DOM and clean up event listeners.
   */
  destroy(): void {
    if (this.buttonElement) {
      this.buttonElement.removeEventListener('click', this.handleClick);
      this.buttonElement.removeEventListener('keydown', this.handleKeyDown);
      this.buttonElement.remove();
      this.buttonElement = null;
    }
  }

  /**
   * Update the button state. Controls visibility based on authentication
   * and overlay status.
   */
  setState(newState: Partial<HelpButtonState>): void {
    this.state = { ...this.state, ...newState };
    this.updateVisibility();
  }

  /**
   * Get the current button state.
   */
  getState(): HelpButtonState {
    return { ...this.state };
  }

  /**
   * Get the underlying DOM element (useful for focus management).
   */
  getElement(): HTMLButtonElement | null {
    return this.buttonElement;
  }

  /**
   * Show the button (for authenticated screens).
   */
  show(): void {
    this.setState({ isVisible: true });
  }

  /**
   * Hide the button (for full-screen modals, system overlays, or unauthenticated screens).
   */
  hide(): void {
    this.setState({ isVisible: false });
  }

  /**
   * Apply inline styles to the button element for fixed positioning,
   * minimum target size, and spacing.
   *
   * Color contrast: white (#ffffff) on blue (#1558b0) = ~5.7:1 ratio,
   * exceeding the 3:1 minimum for interactive elements and 4.5:1 for text.
   */
  private applyStyles(button: HTMLButtonElement): void {
    const { minTargetSize, minSpacing, position } = this.config;

    Object.assign(button.style, {
      position: 'fixed',
      bottom: `${position.bottom}px`,
      right: `${position.right}px`,
      width: `${minTargetSize}px`,
      height: `${minTargetSize}px`,
      minWidth: `${minTargetSize}px`,
      minHeight: `${minTargetSize}px`,
      margin: `${minSpacing}px`,
      padding: '0',
      border: 'none',
      borderRadius: '50%',
      backgroundColor: '#1558b0',
      color: '#ffffff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.25rem',
      fontWeight: 'bold',
      lineHeight: '1',
      zIndex: '9999',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    });
  }

  /**
   * Get the SVG icon markup for the question mark.
   * Uses an inline SVG for crisp rendering at all sizes.
   */
  private getIconMarkup(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`;
  }

  /**
   * Update DOM visibility based on current state.
   * The button is hidden when not on an authenticated screen or when
   * the help viewer is already open.
   */
  private updateVisibility(): void {
    if (!this.buttonElement) return;

    const shouldShow = this.state.isVisible && !this.state.isHelpViewerOpen;
    this.buttonElement.style.display = shouldShow ? 'flex' : 'none';
    this.buttonElement.setAttribute('aria-hidden', String(!shouldShow));

    if (shouldShow) {
      this.buttonElement.tabIndex = 0;
    } else {
      this.buttonElement.tabIndex = -1;
    }
  }

  /**
   * Handle click events on the button.
   * Triggers the state manager to open the help viewer.
   */
  private handleClick = (): void => {
    this.setState({ isHelpViewerOpen: true });
    this.stateManager.open();
  };

  /**
   * Handle keyboard events for accessibility.
   * Enter and Space activate the button (native <button> behavior,
   * but explicitly handled for robustness).
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleClick();
    }
  };
}
