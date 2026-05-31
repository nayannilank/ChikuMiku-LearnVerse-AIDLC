/**
 * HelpViewer Overlay Component
 *
 * A modal overlay that displays the pre-built static HTML User Guide content.
 * The HTML is injected directly into the DOM (no runtime parsing).
 * Extracts the `<nav class="ug-toc">` element from the HTML to populate a TOC sidebar.
 * Handles loading, open, and error states as defined in `HelpViewerState`.
 *
 * Accessibility (WCAG 2.1 AA):
 * - role="dialog" and aria-modal="true" on the overlay container
 * - aria-labelledby pointing to the dialog title for screen readers
 * - Focus trapping within the viewer while open
 * - Escape key dismisses the viewer
 * - Focus returns to the trigger element on close
 * - Color contrast: 4.5:1 for text, 3:1 for interactive elements
 * - Text resizing up to 200% without clipping (rem-based font sizes, overflow handling)
 */

import type { HelpViewerConfig, HelpViewerState } from './types';
import type { UserGuideSourceImpl } from './userGuideSource';

/** Selector for all focusable elements within the viewer */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Default configuration for the HelpViewer */
const DEFAULT_CONFIG: HelpViewerConfig = {
  loadTimeoutMs: 2000,
  closeTimeoutMs: 500,
  trapFocus: true,
};

/**
 * Dependencies required by the HelpViewer.
 * Injected via constructor for testability and platform flexibility.
 */
export interface HelpViewerDependencies {
  /** The content source for loading user guide HTML */
  contentSource: UserGuideSourceImpl;
  /** Callback invoked when the viewer requests to close */
  onClose: () => void;
}

/**
 * HelpViewer class manages its own DOM rendering and lifecycle.
 * It creates a modal overlay element and attaches it to the document body.
 */
export class HelpViewer {
  private readonly config: HelpViewerConfig;
  private readonly deps: HelpViewerDependencies;
  private overlayElement: HTMLDivElement | null = null;
  private state: HelpViewerState = { status: 'closed' };
  private scrollObserver: IntersectionObserver | null = null;
  private isScrollingFromClick = false;
  /** The element that had focus before the viewer opened (typically the HelpButton) */
  private triggerElement: HTMLElement | null = null;

  constructor(deps: HelpViewerDependencies, config?: Partial<HelpViewerConfig>) {
    this.deps = deps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the current viewer state.
   */
  getState(): HelpViewerState {
    return this.state;
  }

  /**
   * Get the underlying overlay DOM element (useful for focus management).
   */
  getElement(): HTMLDivElement | null {
    return this.overlayElement;
  }

  /**
   * Open the help viewer. Transitions to loading state, fetches content,
   * then transitions to open or error state.
   *
   * @param triggerEl - Optional element to return focus to on close.
   *   If not provided, the currently focused element is captured automatically.
   */
  async open(triggerEl?: HTMLElement): Promise<void> {
    // Store the trigger element for focus restoration on close
    this.triggerElement =
      triggerEl ?? (document.activeElement as HTMLElement | null) ?? null;

    this.setState({ status: 'loading' });
    this.render();

    const result = await this.deps.contentSource.load();

    if (result.status === 'success') {
      this.setState({ status: 'open', htmlContent: result.content });
    } else {
      this.setState({
        status: 'error',
        message: result.message,
        canRetry: result.canRetry,
      });
    }

    this.renderContent();
  }

  /**
   * Close the help viewer. Removes the overlay from the DOM and returns
   * focus to the trigger element. Completes within closeTimeoutMs (500ms).
   */
  close(): void {
    this.setState({ status: 'closed' });
    this.destroy();

    // Return focus to the element that triggered the viewer open
    if (this.triggerElement && typeof this.triggerElement.focus === 'function') {
      this.triggerElement.focus();
    }
    this.triggerElement = null;

    // Notify the state manager to restore application state
    this.deps.onClose();
  }

  /**
   * Retry loading content after an error.
   */
  async retry(): Promise<void> {
    this.setState({ status: 'loading' });
    this.renderContent();

    const result = await this.deps.contentSource.load();

    if (result.status === 'success') {
      this.setState({ status: 'open', htmlContent: result.content });
    } else {
      this.setState({
        status: 'error',
        message: result.message,
        canRetry: result.canRetry,
      });
    }

    this.renderContent();
  }

  /**
   * Remove the overlay from the DOM and clean up.
   */
  destroy(): void {
    this.destroyScrollObserver();
    if (this.overlayElement) {
      this.overlayElement.removeEventListener('keydown', this.handleKeyDown);
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }

  /**
   * Render the overlay container and attach it to the DOM.
   * Sets up the modal structure with accessibility attributes.
   *
   * Accessibility attributes applied:
   * - role="dialog": Identifies the overlay as a dialog for assistive technology
   * - aria-modal="true": Indicates content behind the dialog is inert
   * - aria-labelledby: Points to the dialog title element for screen readers
   */
  private render(container: HTMLElement = document.body): void {
    if (this.overlayElement) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'help-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'help-viewer-title');

    this.applyOverlayStyles(overlay);

    // Listen for Escape key and Tab key (for focus trapping)
    overlay.addEventListener('keydown', this.handleKeyDown);

    // Set tabindex so the overlay can receive focus
    overlay.tabIndex = -1;

    this.overlayElement = overlay;
    container.appendChild(overlay);

    // Render initial content (loading state)
    this.renderContent();

    // Focus the overlay for keyboard accessibility
    if (this.config.trapFocus) {
      overlay.focus();
    }
  }

  /**
   * Render the inner content of the overlay based on the current state.
   */
  private renderContent(): void {
    if (!this.overlayElement) return;

    switch (this.state.status) {
      case 'loading':
        this.renderLoadingState();
        break;
      case 'open':
        this.renderOpenState(this.state.htmlContent);
        break;
      case 'error':
        this.renderErrorState(this.state.message, this.state.canRetry);
        break;
      case 'closed':
        // No content to render when closed
        break;
    }
  }

  /**
   * Render the loading state UI.
   */
  private renderLoadingState(): void {
    if (!this.overlayElement) return;

    this.overlayElement.innerHTML = `
      <div class="help-viewer-container" style="${this.getContainerStyles()}">
        <div class="help-viewer-header" style="${this.getHeaderStyles()}">
          <h2 id="help-viewer-title" style="margin: 0; font-size: 1.125rem;">User Guide</h2>
          <button class="help-viewer-close" aria-label="Close User Guide" style="${this.getCloseButtonStyles()}">&times;</button>
        </div>
        <div class="help-viewer-loading" style="${this.getLoadingStyles()}" role="status" aria-live="polite">
          <div class="help-viewer-spinner" style="${this.getSpinnerStyles()}"></div>
          <p style="margin: 12px 0 0; color: #333333; font-size: 1rem;">Loading User Guide...</p>
        </div>
      </div>
    `;

    this.attachCloseHandler();
  }

  /**
   * Render the open state with HTML content and TOC sidebar.
   */
  private renderOpenState(htmlContent: string): void {
    if (!this.overlayElement) return;

    // Parse the HTML to extract TOC and content
    const { tocHtml, contentHtml } = this.extractTocAndContent(htmlContent);
    const hasToc = tocHtml !== null;

    const sidebarMarkup = hasToc
      ? `<aside class="help-viewer-sidebar" style="${this.getSidebarStyles()}" role="navigation" aria-label="Table of Contents">${tocHtml}</aside>`
      : '';

    const bodyStyles = hasToc
      ? this.getBodyWithSidebarStyles()
      : this.getBodyFullWidthStyles();

    this.overlayElement.innerHTML = `
      <div class="help-viewer-container" style="${this.getContainerStyles()}">
        <div class="help-viewer-header" style="${this.getHeaderStyles()}">
          <h2 id="help-viewer-title" style="margin: 0; font-size: 1.125rem;">User Guide</h2>
          <button class="help-viewer-close" aria-label="Close User Guide" style="${this.getCloseButtonStyles()}">&times;</button>
        </div>
        <div class="help-viewer-body" style="${bodyStyles}">
          ${sidebarMarkup}
          <main class="help-viewer-content" style="${this.getContentStyles()}" role="document" aria-label="User Guide content">${contentHtml}</main>
        </div>
      </div>
    `;

    this.attachCloseHandler();
    this.attachTocClickHandlers();
    this.setupScrollObserver();
  }

  /**
   * Render the error state with message and optional retry button.
   */
  private renderErrorState(message: string, canRetry: boolean): void {
    if (!this.overlayElement) return;

    const retryButton = canRetry
      ? `<button class="help-viewer-retry" aria-label="Retry loading User Guide" style="${this.getRetryButtonStyles()}">Retry</button>`
      : '';

    this.overlayElement.innerHTML = `
      <div class="help-viewer-container" style="${this.getContainerStyles()}">
        <div class="help-viewer-header" style="${this.getHeaderStyles()}">
          <h2 id="help-viewer-title" style="margin: 0; font-size: 1.125rem;">User Guide</h2>
          <button class="help-viewer-close" aria-label="Close User Guide" style="${this.getCloseButtonStyles()}">&times;</button>
        </div>
        <div class="help-viewer-error" style="${this.getErrorStyles()}" role="alert" aria-live="assertive">
          <p style="margin: 0 0 16px; color: #b71c1c; font-size: 1rem;">${this.escapeHtml(message)}</p>
          ${retryButton}
        </div>
      </div>
    `;

    this.attachCloseHandler();
    this.attachRetryHandler();
  }

  /**
   * Extract the TOC `<nav class="ug-toc">` element and the remaining content
   * from the pre-built HTML string.
   *
   * If the TOC nav is missing, returns null for tocHtml and the full content
   * as contentHtml — the sidebar will be hidden gracefully.
   */
  private extractTocAndContent(htmlContent: string): {
    tocHtml: string | null;
    contentHtml: string;
  } {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const tocNav = tempDiv.querySelector('nav.ug-toc');

    if (!tocNav) {
      return { tocHtml: null, contentHtml: htmlContent };
    }

    const tocHtml = tocNav.innerHTML;

    // Remove the TOC nav from the content so it's not duplicated
    tocNav.remove();
    const contentHtml = tempDiv.innerHTML;

    return { tocHtml, contentHtml };
  }

  /**
   * Escape HTML special characters to prevent XSS in error messages.
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach click handler to the close button.
   */
  private attachCloseHandler(): void {
    if (!this.overlayElement) return;

    const closeBtn = this.overlayElement.querySelector('.help-viewer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  /**
   * Attach click handler to the retry button (if present).
   */
  private attachRetryHandler(): void {
    if (!this.overlayElement) return;

    const retryBtn = this.overlayElement.querySelector('.help-viewer-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.retry());
    }
  }

  /**
   * Attach click handlers to TOC links for smooth scrolling to anchors.
   */
  private attachTocClickHandlers(): void {
    if (!this.overlayElement) return;

    const tocLinks = this.overlayElement.querySelectorAll('.help-viewer-sidebar a[href^="#"]');
    const contentContainer = this.overlayElement.querySelector('.help-viewer-content');

    tocLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const href = link.getAttribute('href');
        if (!href || !contentContainer) return;

        const targetId = href.slice(1); // Remove the '#'
        const targetElement = contentContainer.querySelector(`#${CSS.escape(targetId)}`);
        if (!targetElement) return;

        // Mark that we're scrolling from a click to suppress observer updates
        this.isScrollingFromClick = true;

        // Highlight the active TOC entry
        this.setActiveTocEntry(link as HTMLElement);

        // Smooth scroll to the target within 500ms
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Reset the click flag after scroll completes
        setTimeout(() => {
          this.isScrollingFromClick = false;
        }, 500);
      });
    });
  }

  /**
   * Set the active TOC entry by adding a visual highlight.
   * Uses #0d47a1 (dark blue) which meets 4.5:1 contrast ratio against white background.
   */
  private setActiveTocEntry(activeLink: HTMLElement): void {
    if (!this.overlayElement) return;

    // Remove active class from all TOC links
    const allLinks = this.overlayElement.querySelectorAll('.help-viewer-sidebar a');
    allLinks.forEach((link) => {
      (link as HTMLElement).style.fontWeight = '';
      (link as HTMLElement).style.color = '';
    });

    // Highlight the active link with a high-contrast color
    activeLink.style.fontWeight = 'bold';
    activeLink.style.color = '#0d47a1';
  }

  /**
   * Set up an IntersectionObserver to track which section is currently visible
   * and update the active TOC entry accordingly.
   */
  private setupScrollObserver(): void {
    if (!this.overlayElement) return;

    const contentContainer = this.overlayElement.querySelector('.help-viewer-content');
    if (!contentContainer) return;

    const headings = contentContainer.querySelectorAll('h2[id], h3[id]');
    if (headings.length === 0) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (this.isScrollingFromClick) return;

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            if (!id || !this.overlayElement) continue;

            const tocLink = this.overlayElement.querySelector(
              `.help-viewer-sidebar a[href="#${CSS.escape(id)}"]`
            );
            if (tocLink) {
              this.setActiveTocEntry(tocLink as HTMLElement);
            }
            break;
          }
        }
      },
      {
        root: contentContainer,
        rootMargin: '0px 0px -80% 0px',
        threshold: 0,
      }
    );

    headings.forEach((heading) => {
      this.scrollObserver!.observe(heading);
    });
  }

  /**
   * Clean up the scroll observer.
   */
  private destroyScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
  }

  /**
   * Get all focusable elements within the overlay.
   */
  private getFocusableElements(): HTMLElement[] {
    if (!this.overlayElement) return [];
    return Array.from(
      this.overlayElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
  }

  /**
   * Handle keyboard events for accessibility.
   * - Escape key closes the viewer.
   * - Tab / Shift+Tab traps focus within the viewer.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }

    // Focus trapping: cycle Tab/Shift+Tab within the viewer
    if (event.key === 'Tab' && this.config.trapFocus) {
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if focus is on the first element, wrap to the last
        if (
          document.activeElement === firstFocusable ||
          document.activeElement === this.overlayElement
        ) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if focus is on the last element, wrap to the first
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  };

  /**
   * Update the internal state.
   */
  private setState(newState: HelpViewerState): void {
    this.state = newState;
  }

  // --- Inline Styles ---
  // Using inline styles to keep the component self-contained without external CSS dependencies.

  private applyOverlayStyles(element: HTMLDivElement): void {
    Object.assign(element.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000',
      padding: '16px',
      boxSizing: 'border-box',
    });
  }

  private getContainerStyles(): string {
    return [
      'background: #ffffff',
      'border-radius: 12px',
      'width: 100%',
      'max-width: 900px',
      'height: 90vh',
      'max-height: 90vh',
      'display: flex',
      'flex-direction: column',
      'overflow: hidden',
      'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2)',
      'color: #1a1a1a',
    ].join('; ');
  }

  private getHeaderStyles(): string {
    return [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'padding: 16px 20px',
      'border-bottom: 1px solid #e0e0e0',
      'flex-shrink: 0',
    ].join('; ');
  }

  private getCloseButtonStyles(): string {
    return [
      'background: none',
      'border: 2px solid transparent',
      'font-size: 1.5rem',
      'cursor: pointer',
      'padding: 4px 8px',
      'border-radius: 4px',
      'color: #1a1a1a',
      'line-height: 1',
      'min-width: 44px',
      'min-height: 44px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join('; ');
  }

  private getLoadingStyles(): string {
    return [
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'flex: 1',
      'padding: 40px',
    ].join('; ');
  }

  private getSpinnerStyles(): string {
    return [
      'width: 32px',
      'height: 32px',
      'border: 3px solid #e0e0e0',
      'border-top-color: #1a73e8',
      'border-radius: 50%',
      'animation: help-viewer-spin 0.8s linear infinite',
    ].join('; ');
  }

  private getErrorStyles(): string {
    return [
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'flex: 1',
      'padding: 40px',
      'text-align: center',
    ].join('; ');
  }

  private getRetryButtonStyles(): string {
    return [
      'background: #1558b0',
      'color: #ffffff',
      'border: none',
      'border-radius: 6px',
      'padding: 10px 24px',
      'font-size: 0.875rem',
      'cursor: pointer',
      'min-width: 44px',
      'min-height: 44px',
    ].join('; ');
  }

  private getSidebarStyles(): string {
    return [
      'width: 240px',
      'min-width: 180px',
      'border-right: 1px solid #e0e0e0',
      'overflow-y: auto',
      'overflow-x: hidden',
      'padding: 16px',
      'flex-shrink: 0',
      'font-size: 0.875rem',
      'word-wrap: break-word',
      'overflow-wrap: break-word',
    ].join('; ');
  }

  private getBodyWithSidebarStyles(): string {
    return [
      'display: flex',
      'flex: 1',
      'overflow: hidden',
    ].join('; ');
  }

  private getBodyFullWidthStyles(): string {
    return [
      'display: flex',
      'flex: 1',
      'overflow: hidden',
    ].join('; ');
  }

  private getContentStyles(): string {
    return [
      'flex: 1',
      'overflow-y: auto',
      'overflow-x: hidden',
      'padding: 20px',
      'line-height: 1.6',
      'font-size: 1rem',
      'word-wrap: break-word',
      'overflow-wrap: break-word',
    ].join('; ');
  }
}
