/**
 * HelpViewerStateManager
 *
 * Manages the lifecycle of the help viewer, including capturing and restoring
 * application state (scroll position, form values, media positions, route).
 * Ensures the learner returns to their exact previous state after closing the viewer.
 *
 * Dependencies are injected via constructor for testability and platform independence.
 */

import type { AppStateSnapshot } from './types';

/**
 * Dependencies required by the state manager.
 * Injected via constructor for testability and platform flexibility.
 */
export interface StateManagerDependencies {
  /** Navigate to a given route path */
  navigate: (route: string) => void;
  /** Get the current route path */
  getCurrentRoute: () => string;
  /** Callback invoked to open the help viewer UI */
  onViewerOpen: () => Promise<void>;
  /** Callback invoked to close the help viewer UI */
  onViewerClose: () => Promise<void>;
  /** Navigate to the parent screen (fallback on restore failure) */
  navigateToParent: () => void;
  /** Display an error message to the user */
  showError: (message: string) => void;
  /** Get the parent screen name for error messaging */
  getParentScreenName: () => string;
}

/**
 * HelpViewerStateManager implementation.
 *
 * Captures application state before opening the help viewer and restores it
 * after closing. Handles restoration failures gracefully by navigating to
 * the parent screen without discarding saved progress.
 */
export class HelpViewerStateManager {
  private snapshot: AppStateSnapshot | null = null;
  private readonly deps: StateManagerDependencies;

  constructor(deps: StateManagerDependencies) {
    this.deps = deps;
  }

  /**
   * Capture the current application state.
   * Reads scroll position, form input values, media playback positions,
   * and the current route.
   */
  captureState(): AppStateSnapshot {
    const scrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
    };

    const activeElementId =
      document.activeElement && document.activeElement.id
        ? document.activeElement.id
        : undefined;

    const formValues = this.collectFormValues();
    const mediaPositions = this.collectMediaPositions();
    const currentRoute = this.deps.getCurrentRoute();

    const state: AppStateSnapshot = {
      scrollPosition,
      activeElementId,
      formValues,
      mediaPositions,
      currentRoute,
    };

    return state;
  }

  /**
   * Restore a previously captured application state snapshot.
   * Restores route, scroll position, form values, and media positions.
   * Returns true on success, false on failure.
   */
  restoreState(snapshot: AppStateSnapshot): boolean {
    try {
      // Navigate to the route if it differs from the current one
      const currentRoute = this.deps.getCurrentRoute();
      if (currentRoute !== snapshot.currentRoute) {
        this.deps.navigate(snapshot.currentRoute);
      }

      // Restore scroll position
      window.scrollTo(snapshot.scrollPosition.x, snapshot.scrollPosition.y);

      // Restore form values
      this.restoreFormValues(snapshot.formValues);

      // Restore media positions
      this.restoreMediaPositions(snapshot.mediaPositions);

      // Restore focus to the previously active element
      if (snapshot.activeElementId) {
        const element = document.getElementById(snapshot.activeElementId);
        if (element && typeof element.focus === 'function') {
          element.focus();
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open the help viewer.
   * Captures the current application state, then signals the viewer to open.
   */
  async open(): Promise<void> {
    this.snapshot = this.captureState();
    await this.deps.onViewerOpen();
  }

  /**
   * Close the help viewer.
   * Signals the viewer to close, then restores the captured state.
   * On restoration failure, navigates to the parent screen gracefully.
   */
  async close(): Promise<void> {
    await this.deps.onViewerClose();

    if (this.snapshot) {
      const restored = this.restoreState(this.snapshot);
      if (!restored) {
        const parentName = this.deps.getParentScreenName();
        this.deps.showError(
          `We couldn't restore your previous screen. You've been taken to ${parentName}.`
        );
        this.deps.navigateToParent();
      }
      this.snapshot = null;
    }
  }

  /**
   * Get the currently held snapshot (for testing purposes).
   */
  getSnapshot(): AppStateSnapshot | null {
    return this.snapshot;
  }

  /**
   * Collect values from all form input elements on the page.
   * Targets inputs, textareas, and selects that have an id or name attribute.
   */
  private collectFormValues(): Record<string, string> {
    const values: Record<string, string> = {};

    const inputs = document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input, textarea, select');

    for (const input of inputs) {
      const key = input.id || input.name;
      if (!key) continue;

      if (input instanceof HTMLInputElement) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          values[key] = input.checked ? 'true' : 'false';
        } else {
          values[key] = input.value;
        }
      } else {
        values[key] = input.value;
      }
    }

    return values;
  }

  /**
   * Collect current playback positions from all audio and video elements.
   * Only elements with an id are tracked.
   */
  private collectMediaPositions(): Record<string, number> {
    const positions: Record<string, number> = {};

    const mediaElements = document.querySelectorAll<
      HTMLAudioElement | HTMLVideoElement
    >('audio, video');

    for (const media of mediaElements) {
      if (media.id) {
        positions[media.id] = media.currentTime;
      }
    }

    return positions;
  }

  /**
   * Restore form input values from a snapshot.
   */
  private restoreFormValues(formValues: Record<string, string>): void {
    for (const [key, value] of Object.entries(formValues)) {
      const element =
        document.getElementById(key) ||
        document.querySelector<HTMLElement>(`[name="${key}"]`);

      if (!element) continue;

      if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = value === 'true';
        } else {
          element.value = value;
        }
      } else if (
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        element.value = value;
      }
    }
  }

  /**
   * Restore media playback positions from a snapshot.
   */
  private restoreMediaPositions(mediaPositions: Record<string, number>): void {
    for (const [elementId, seconds] of Object.entries(mediaPositions)) {
      const media = document.getElementById(elementId) as
        | HTMLAudioElement
        | HTMLVideoElement
        | null;

      if (media && typeof media.currentTime === 'number') {
        media.currentTime = seconds;
      }
    }
  }
}
