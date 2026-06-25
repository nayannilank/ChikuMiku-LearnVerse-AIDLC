/**
 * BottomNavigation Component
 *
 * Mobile bottom navigation bar with 5 tabs: Home, Chapters, Scan, Revision, Me.
 * Each tab displays an icon and label, with visual highlighting for the active tab.
 *
 * Validates: Requirements 4.1, 4.2, 3.5
 * - 4.1: Displays five tabs with icons and labels on mobile
 * - 4.2: Navigates to corresponding section and highlights active tab on tap
 * - 3.5: Applies mobile-specific layout with 44px height on 320-420px viewports
 */

/**
 * Represents a single navigation tab item in the bottom navigation bar.
 */
export interface NavigationTab {
  /** Unique identifier for the tab */
  id: string;
  /** Display label shown below the icon */
  label: string;
  /** Icon identifier string (e.g., icon name for the icon library) */
  icon: string;
  /** Route path the tab navigates to */
  route: string;
}

/**
 * Callback type for tab press events.
 */
export type TabPressCallback = (tabId: string) => void;

/**
 * Configuration for the BottomNavigation component dimensions and viewport constraints.
 */
export interface BottomNavigationConfig {
  /** Total height of the navigation bar in pixels */
  height: number;
  /** Minimum supported viewport width in pixels */
  minViewportWidth: number;
  /** Maximum supported viewport width in pixels */
  maxViewportWidth: number;
}

/**
 * Default navigation tabs for the LearnVerse mobile application.
 */
const DEFAULT_TABS: NavigationTab[] = [
  { id: 'home', label: 'Home', icon: 'home', route: '/home' },
  { id: 'chapters', label: 'Chapters', icon: 'book', route: '/chapters' },
  { id: 'scan', label: 'Scan', icon: 'camera', route: '/scan' },
  { id: 'revision', label: 'Revision', icon: 'refresh', route: '/revision' },
  { id: 'me', label: 'Me', icon: 'user', route: '/me' },
];

/**
 * BottomNavigation provides the mobile bottom tab bar with 5 navigation items.
 * It manages active tab state and dispatches navigation callbacks on tab press.
 *
 * The component is designed for mobile viewports (320-420px width) and renders
 * at a fixed 44px height as specified in the design system.
 */
export class BottomNavigation {
  /** Fixed height of the navigation bar (44px per Requirement 3.5) */
  public readonly height: number = 44;

  /** The five navigation tabs */
  public readonly tabs: ReadonlyArray<NavigationTab>;

  /** Currently active tab ID */
  private _activeTab: string;

  /** Registered tab press callback */
  private _onTabPress: TabPressCallback | null = null;

  /** Navigation configuration with viewport constraints */
  public readonly config: BottomNavigationConfig = {
    height: 44,
    minViewportWidth: 320,
    maxViewportWidth: 420,
  };

  constructor(initialActiveTab?: string) {
    this.tabs = DEFAULT_TABS;
    this._activeTab = initialActiveTab ?? DEFAULT_TABS[0].id;
  }

  /**
   * Gets the currently active tab ID.
   */
  get activeTab(): string {
    return this._activeTab;
  }

  /**
   * Sets the active tab by ID. Only accepts valid tab IDs.
   */
  set activeTab(tabId: string) {
    if (this.isValidTabId(tabId)) {
      this._activeTab = tabId;
    }
  }

  /**
   * Returns the currently active tab ID.
   */
  getActiveTab(): string {
    return this._activeTab;
  }

  /**
   * Registers a callback to be invoked when a tab is pressed.
   */
  onTabPress(callback: TabPressCallback): void {
    this._onTabPress = callback;
  }

  /**
   * Simulates a tab press event. Updates the active tab and invokes the
   * registered callback if one exists.
   *
   * @param tabId - The ID of the tab being pressed
   * @returns true if the tab press was handled, false if the tabId is invalid
   */
  pressTab(tabId: string): boolean {
    if (!this.isValidTabId(tabId)) {
      return false;
    }
    this._activeTab = tabId;
    if (this._onTabPress) {
      this._onTabPress(tabId);
    }
    return true;
  }

  /**
   * Returns the full NavigationTab object for the currently active tab.
   */
  getActiveTabInfo(): NavigationTab | undefined {
    return this.tabs.find((tab) => tab.id === this._activeTab);
  }

  /**
   * Checks whether the given tab ID corresponds to a valid tab.
   */
  private isValidTabId(tabId: string): boolean {
    return this.tabs.some((tab) => tab.id === tabId);
  }
}
