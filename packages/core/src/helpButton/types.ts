/**
 * Help Button & Help Viewer Types
 *
 * Core interfaces and types for the help button component and help viewer.
 * These are platform-independent definitions consumed by both web and Android implementations.
 */

// --- Help Button ---

/** Configuration for the help button component */
export interface HelpButtonConfig {
  /** Accessible label for screen readers */
  ariaLabel: string; // always "Help"
  /** Minimum tap/click target size in dp/CSS pixels */
  minTargetSize: number; // 44
  /** Minimum spacing from adjacent interactive elements in dp */
  minSpacing: number; // 8
  /** Position anchor */
  position: { bottom: number; right: number };
}

/** Help button state */
export interface HelpButtonState {
  isVisible: boolean;
  isHelpViewerOpen: boolean;
}

// --- Help Viewer ---

/** Help viewer configuration */
export interface HelpViewerConfig {
  /** Maximum time to load content before showing error (ms) */
  loadTimeoutMs: number; // 2000
  /** Maximum time for close animation (ms) */
  closeTimeoutMs: number; // 500
  /** Whether to enable focus trapping */
  trapFocus: boolean; // true
}

/** Help viewer state */
export type HelpViewerState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'open'; htmlContent: string; activeSection?: string }
  | { status: 'error'; message: string; canRetry: boolean };

// --- Application State ---

/** Captured application state before opening help viewer */
export interface AppStateSnapshot {
  scrollPosition: { x: number; y: number };
  activeElementId?: string;
  formValues: Record<string, string>;
  mediaPositions: Record<string, number>; // elementId -> seconds
  currentRoute: string;
}

// --- Content Loading ---

/** Content loading result */
export type LoadResult =
  | { status: 'success'; content: string; fromCache: boolean }
  | { status: 'error'; message: string; canRetry: boolean };

// --- Cache ---

/** Cache entry structure for the user guide HTML content */
export interface UserGuideCacheEntry {
  content: string; // HTML string
  cachedAt: number; // Unix timestamp
  version: string; // hash of content for change detection
}
