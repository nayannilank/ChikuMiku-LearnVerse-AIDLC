import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderReactRoute, cleanupCurrentMount, getCurrentMount } from './reactBridge';

// Simple test component that renders a div with given text
function TestComponent({ text }: { text: string }) {
  return createElement('span', { 'data-testid': 'test-component' }, text);
}

describe('reactBridge', () => {
  beforeEach(() => {
    // Reset any existing mount between tests
    cleanupCurrentMount();
  });

  afterEach(() => {
    cleanupCurrentMount();
  });

  describe('renderReactRoute', () => {
    it('returns an HTMLElement with className react-route-container', () => {
      const element = createElement(TestComponent, { text: 'hello' });
      const container = renderReactRoute(element);

      expect(container).toBeInstanceOf(HTMLDivElement);
      expect(container.className).toBe('react-route-container');
    });

    it('mounts the React element into the container', async () => {
      const element = createElement(TestComponent, { text: 'mounted' });
      const container = renderReactRoute(element);

      // React rendering is async in createRoot, so wait a tick
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="test-component"]')).not.toBeNull();
      });

      expect(container.textContent).toBe('mounted');
    });

    it('tracks currentMount state after rendering', () => {
      const element = createElement(TestComponent, { text: 'track' });
      renderReactRoute(element);

      const mount = getCurrentMount();
      expect(mount).not.toBeNull();
      expect(mount!.container.className).toBe('react-route-container');
    });

    it('creates a fresh root for each navigation (unmounts previous)', async () => {
      const element1 = createElement(TestComponent, { text: 'first' });
      const container1 = renderReactRoute(element1);

      await vi.waitFor(() => {
        expect(container1.textContent).toBe('first');
      });

      const element2 = createElement(TestComponent, { text: 'second' });
      const container2 = renderReactRoute(element2);

      await vi.waitFor(() => {
        expect(container2.textContent).toBe('second');
      });

      // The first container should be unmounted (empty after unmount)
      expect(container1.textContent).toBe('');
      // currentMount should reference the second container
      expect(getCurrentMount()!.container).toBe(container2);
    });

    it('passes arbitrary props to the mounted component', async () => {
      function PropsComponent({ name, count }: { name: string; count: number }) {
        return createElement('div', { 'data-name': name, 'data-count': count }, `${name}:${count}`);
      }

      const element = createElement(PropsComponent, { name: 'test', count: 42 });
      const container = renderReactRoute(element);

      await vi.waitFor(() => {
        const rendered = container.querySelector('[data-name="test"]');
        expect(rendered).not.toBeNull();
        expect(rendered!.getAttribute('data-count')).toBe('42');
        expect(rendered!.textContent).toBe('test:42');
      });
    });
  });

  describe('cleanupCurrentMount', () => {
    it('unmounts the current React root', async () => {
      const element = createElement(TestComponent, { text: 'cleanup' });
      const container = renderReactRoute(element);

      await vi.waitFor(() => {
        expect(container.textContent).toBe('cleanup');
      });

      cleanupCurrentMount();

      expect(getCurrentMount()).toBeNull();
      // After unmount, container content is cleared
      expect(container.textContent).toBe('');
    });

    it('is safe to call when no mount exists', () => {
      expect(getCurrentMount()).toBeNull();
      // Should not throw
      cleanupCurrentMount();
      expect(getCurrentMount()).toBeNull();
    });
  });

  describe('MutationObserver unmount detection', () => {
    it('cleans up when container is removed from parent', async () => {
      const parent = document.createElement('div');
      document.body.appendChild(parent);

      const element = createElement(TestComponent, { text: 'observe' });
      const container = renderReactRoute(element);
      parent.appendChild(container);

      await vi.waitFor(() => {
        expect(container.textContent).toBe('observe');
      });

      // Trigger requestAnimationFrame for observer setup
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Simulate router replacing content (removes the container)
      parent.innerHTML = '';

      // Wait for MutationObserver to fire
      await vi.waitFor(() => {
        expect(getCurrentMount()).toBeNull();
      });

      document.body.removeChild(parent);
    });
  });
});
