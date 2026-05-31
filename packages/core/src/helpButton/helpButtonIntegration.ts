/**
 * HelpButton App Shell Integration
 *
 * Wires together the HelpButton, HelpViewer, HelpViewerStateManager,
 * UserGuideSource, and UserGuideCache into a cohesive unit that can be
 * mounted into the authenticated app shell.
 *
 * Responsibilities:
 * - Renders the HelpButton on all authenticated screens
 * - Hides the HelpButton during full-screen modals and system overlays
 * - Connects HelpButton click → state capture → HelpViewer open
 * - Connects HelpViewer close → state restoration → HelpButton re-shown
 * - Manages the lifecycle of all help-related components
 *
 * Usage:
 *   const integration = new HelpButtonIntegration({ ... });
 *   integration.mount();          // After authentication
 *   integration.unmount();        // On logout or cleanup
 *   integration.setOverlayActive(true);  // Hide during full-screen modals
 *   integration.setOverlayActive(false); // Show again when modal closes
 */

import { HelpButton } from './helpButton';
import { HelpViewer } from './helpViewer';
import { HelpViewerStateManager } from './stateManager';
import { UserGuideSourceImpl } from './userGuideSource';
import { UserGuideCache } from './userGuideCache';
import type { Platform, AssetLoader } from './userGuideSource';

/**
 * Configuration options for the HelpButton integration.
 */
export interface HelpButtonIntegrationConfig {
  /** Platform the app is running on (defaults to 'web') */
  platform?: Platform;
  /** Asset loader for Android bundled assets (required when platform is 'android') */
  assetLoader?: AssetLoader;
  /** URL path to the static HTML user guide file (defaults to '/user-guide.html') */
  htmlPath?: string;
  /** Custom fetch function (useful for testing) */
  fetchFn?: typeof fetch;
  /** Custom online check function (useful for testing) */
  isOnlineFn?: () => boolean;
  /** Get the current route path */
  getCurrentRoute?: () => string;
  /** Navigate to a given route path */
  navigate?: (route: string) => void;
  /** Navigate to the parent screen (fallback on restore failure) */
  navigateToParent?: () => void;
  /** Display an error message to the user */
  showError?: (message: string) => void;
  /** Get the parent screen name for error messaging */
  getParentScreenName?: () => string;
  /** Container element to render the HelpButton into (defaults to document.body) */
  container?: HTMLElement;
}

/**
 * HelpButtonIntegration orchestrates the full help button experience
 * within the authenticated app shell.
 *
 * It creates and manages:
 * - UserGuideCache (localStorage-based caching)
 * - UserGuideSourceImpl (content loading with offline support)
 * - HelpViewerStateManager (state capture/restore lifecycle)
 * - HelpButton (fixed-position UI element)
 * - HelpViewer (modal overlay for displaying the user guide)
 */
export class HelpButtonIntegration {
  private readonly config: HelpButtonIntegrationConfig;
  private readonly cache: UserGuideCache;
  private readonly source: UserGuideSourceImpl;
  private stateManager!: HelpViewerStateManager;
  private helpButton!: HelpButton;
  private helpViewer!: HelpViewer;
  private isMounted = false;
  private isOverlayActive = false;
  private isAuthenticated = false;

  constructor(config: HelpButtonIntegrationConfig = {}) {
    this.config = config;

    // Initialize the cache
    this.cache = new UserGuideCache();

    // Initialize the content source
    this.source = new UserGuideSourceImpl({
      cache: this.cache,
      platform: config.platform ?? 'web',
      assetLoader: config.assetLoader,
      htmlPath: config.htmlPath,
      fetchFn: config.fetchFn,
      isOnlineFn: config.isOnlineFn,
    });

    // Initialize all components
    this.initializeComponents();
  }

  /**
   * Mount the help button into the app shell.
   * Call this after the user has authenticated.
   * The button becomes visible on all screens except full-screen modals
   * and system overlays.
   */
  mount(container?: HTMLElement): void {
    if (this.isMounted) return;

    this.isAuthenticated = true;
    this.isMounted = true;

    const target = container ?? this.config.container ?? document.body;
    this.helpButton.render(target);
    this.updateButtonVisibility();
  }

  /**
   * Unmount the help button and clean up all resources.
   * Call this on logout or when the app shell is destroyed.
   */
  unmount(): void {
    if (!this.isMounted) return;

    this.isAuthenticated = false;
    this.isMounted = false;

    // Close the viewer if it's open
    if (this.helpViewer.getState().status !== 'closed') {
      this.helpViewer.destroy();
    }

    // Remove the button from the DOM
    this.helpButton.destroy();
  }

  /**
   * Notify the integration that a full-screen modal or system overlay
   * has been activated or deactivated.
   *
   * When active, the HelpButton is hidden (per requirement 1.1/1.2:
   * "excluding full-screen modals and system-level overlays").
   */
  setOverlayActive(active: boolean): void {
    this.isOverlayActive = active;
    this.updateButtonVisibility();
  }

  /**
   * Check if the help viewer is currently open.
   */
  isViewerOpen(): boolean {
    return this.helpViewer.getState().status !== 'closed';
  }

  /**
   * Check if the help button is currently mounted and visible.
   */
  isButtonVisible(): boolean {
    return this.isMounted && this.isAuthenticated && !this.isOverlayActive;
  }

  /**
   * Get the HelpButton instance (for testing or advanced use cases).
   */
  getHelpButton(): HelpButton {
    return this.helpButton;
  }

  /**
   * Get the HelpViewer instance (for testing or advanced use cases).
   */
  getHelpViewer(): HelpViewer {
    return this.helpViewer;
  }

  /**
   * Get the HelpViewerStateManager instance (for testing or advanced use cases).
   */
  getStateManager(): HelpViewerStateManager {
    return this.stateManager;
  }

  /**
   * Initialize all components with proper wiring.
   * Sets up the dependency graph:
   *   HelpButton → StateManager → HelpViewer → UserGuideSource
   */
  private initializeComponents(): void {
    const {
      getCurrentRoute = () => window.location.pathname,
      navigate = (route: string) => { window.location.pathname = route; },
      navigateToParent = () => { window.history.back(); },
      showError = (message: string) => { console.error('[HelpButton]', message); },
      getParentScreenName = () => 'Home',
    } = this.config;

    // Create the state manager with lifecycle callbacks
    this.stateManager = new HelpViewerStateManager({
      getCurrentRoute,
      navigate,
      navigateToParent,
      showError,
      getParentScreenName,
      onViewerOpen: async () => {
        await this.helpViewer.open(this.helpButton.getElement() ?? undefined);
      },
      onViewerClose: async () => {
        // No-op: the viewer handles its own close via the onClose callback
      },
    });

    // Create the help viewer with content source and close callback
    this.helpViewer = new HelpViewer({
      contentSource: this.source,
      onClose: () => {
        // When the viewer closes, restore state and re-show the button
        this.helpButton.setState({ isHelpViewerOpen: false });
        this.restoreStateAfterClose();
      },
    });

    // Create the help button wired to the state manager
    this.helpButton = new HelpButton({
      stateManager: this.stateManager,
    });
  }

  /**
   * Restore application state after the help viewer closes.
   * The state manager handles the actual restoration logic.
   */
  private restoreStateAfterClose(): void {
    const snapshot = this.stateManager.getSnapshot();
    if (snapshot) {
      const restored = this.stateManager.restoreState(snapshot);
      if (!restored) {
        const parentName = this.config.getParentScreenName?.() ?? 'Home';
        const showError = this.config.showError ?? ((msg: string) => console.error('[HelpButton]', msg));
        showError(`We couldn't restore your previous screen. You've been taken to ${parentName}.`);
        const navigateToParent = this.config.navigateToParent ?? (() => window.history.back());
        navigateToParent();
      }
    }
  }

  /**
   * Update the HelpButton visibility based on authentication state
   * and overlay status.
   */
  private updateButtonVisibility(): void {
    if (!this.isMounted) return;

    const shouldShow = this.isAuthenticated && !this.isOverlayActive;
    if (shouldShow) {
      this.helpButton.show();
    } else {
      this.helpButton.hide();
    }
  }
}
