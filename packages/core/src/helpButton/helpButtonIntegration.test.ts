/**
 * Unit tests for HelpButtonIntegration
 *
 * Tests the wiring between HelpButton, HelpViewer, and HelpViewerStateManager
 * within the authenticated app shell context.
 *
 * Uses a minimal DOM mock (via JSDOM-like environment provided by vitest)
 * to validate component lifecycle and visibility behavior.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HelpButtonIntegration } from './helpButtonIntegration';

describe('HelpButtonIntegration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock localStorage for UserGuideCache
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('mount and unmount lifecycle', () => {
    it('should render the HelpButton into the container on mount', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();

      const button = container.querySelector('button.help-button');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-label')).toBe('Help');
    });

    it('should remove the HelpButton from the DOM on unmount', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();
      expect(container.querySelector('button.help-button')).not.toBeNull();

      integration.unmount();
      expect(container.querySelector('button.help-button')).toBeNull();
    });

    it('should be a no-op if mount is called twice', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();
      integration.mount();

      const buttons = container.querySelectorAll('button.help-button');
      expect(buttons.length).toBe(1);
    });

    it('should accept a custom container in mount()', () => {
      const customContainer = document.createElement('div');
      document.body.appendChild(customContainer);

      const integration = new HelpButtonIntegration({
        fetchFn: vi.fn(),
      });

      integration.mount(customContainer);

      expect(customContainer.querySelector('button.help-button')).not.toBeNull();
      expect(container.querySelector('button.help-button')).toBeNull();
    });
  });

  describe('visibility control', () => {
    it('should show the button after mount (authenticated state)', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();

      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      expect(button.style.display).toBe('flex');
    });

    it('should hide the button when overlay is active', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();
      integration.setOverlayActive(true);

      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      expect(button.style.display).toBe('none');
    });

    it('should show the button again when overlay is deactivated', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();
      integration.setOverlayActive(true);
      integration.setOverlayActive(false);

      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      expect(button.style.display).toBe('flex');
    });

    it('should report correct visibility state', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      expect(integration.isButtonVisible()).toBe(false); // Not mounted yet

      integration.mount();
      expect(integration.isButtonVisible()).toBe(true);

      integration.setOverlayActive(true);
      expect(integration.isButtonVisible()).toBe(false);

      integration.setOverlayActive(false);
      expect(integration.isButtonVisible()).toBe(true);

      integration.unmount();
      expect(integration.isButtonVisible()).toBe(false);
    });
  });

  describe('HelpButton click opens HelpViewer with state capture', () => {
    it('should open the HelpViewer when the button is clicked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article class="ug-content"><h2 id="test">Test</h2></article>'),
      });

      const integration = new HelpButtonIntegration({
        container,
        fetchFn: mockFetch,
        isOnlineFn: () => true,
      });

      integration.mount();

      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      button.click();

      // Wait for async operations
      await vi.waitFor(() => {
        const overlay = document.querySelector('.help-viewer-overlay');
        expect(overlay).not.toBeNull();
      });
    });

    it('should capture state before opening the viewer', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article class="ug-content"><p>Content</p></article>'),
      });

      const integration = new HelpButtonIntegration({
        container,
        fetchFn: mockFetch,
        isOnlineFn: () => true,
        getCurrentRoute: () => '/lesson/123',
      });

      integration.mount();

      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      button.click();

      // Wait for the viewer to open
      await vi.waitFor(() => {
        expect(document.querySelector('.help-viewer-overlay')).not.toBeNull();
      });

      // The state manager should have captured the state
      const snapshot = integration.getStateManager().getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot?.currentRoute).toBe('/lesson/123');
    });
  });

  describe('HelpViewer close restores state', () => {
    it('should restore state and re-show the button when viewer is closed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article class="ug-content"><p>Content</p></article>'),
      });

      const navigateFn = vi.fn();

      const integration = new HelpButtonIntegration({
        container,
        fetchFn: mockFetch,
        isOnlineFn: () => true,
        getCurrentRoute: () => '/lesson/123',
        navigate: navigateFn,
      });

      integration.mount();

      // Click the help button to open the viewer
      const button = container.querySelector('button.help-button') as HTMLButtonElement;
      button.click();

      // Wait for the viewer to open
      await vi.waitFor(() => {
        expect(document.querySelector('.help-viewer-overlay')).not.toBeNull();
      });

      // Close the viewer via the close button
      const closeBtn = document.querySelector('.help-viewer-close') as HTMLButtonElement;
      expect(closeBtn).not.toBeNull();
      closeBtn.click();

      // The overlay should be removed
      expect(document.querySelector('.help-viewer-overlay')).toBeNull();

      // The help button should be visible again
      const helpButton = container.querySelector('button.help-button') as HTMLButtonElement;
      expect(helpButton.style.display).toBe('flex');
    });
  });

  describe('component access', () => {
    it('should expose the HelpButton instance', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      expect(integration.getHelpButton()).toBeDefined();
    });

    it('should expose the HelpViewer instance', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      expect(integration.getHelpViewer()).toBeDefined();
    });

    it('should expose the StateManager instance', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      expect(integration.getStateManager()).toBeDefined();
    });
  });

  describe('viewer state reporting', () => {
    it('should report viewer as not open initially', () => {
      const integration = new HelpButtonIntegration({
        container,
        fetchFn: vi.fn(),
      });

      integration.mount();
      expect(integration.isViewerOpen()).toBe(false);
    });
  });
});
