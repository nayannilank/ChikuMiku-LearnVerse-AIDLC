import { type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

interface MountedRoute {
  root: Root;
  container: HTMLElement;
  observer: MutationObserver;
}

let currentMount: MountedRoute | null = null;

/**
 * Mounts a React element into an HTMLElement container suitable for the
 * vanilla-DOM hash router. Automatically unmounts the previous React root
 * when the container is removed from the DOM (via MutationObserver).
 *
 * Each call creates a fresh React root — repeated navigations to the same
 * route produce a new root every time. The previous root is unmounted first
 * to prevent memory leaks.
 *
 * @param element - The React element to render (can include arbitrary props)
 * @returns HTMLElement containing the mounted React tree
 */
export function renderReactRoute(element: ReactElement): HTMLElement {
  // Cleanup previous mount if still active
  cleanupCurrentMount();

  const container = document.createElement('div');
  container.className = 'react-route-container';

  const root = createRoot(container);
  root.render(element);

  // Observe parent for removal (router replaces innerHTML)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removed of Array.from(mutation.removedNodes)) {
        if (removed === container || (removed as Element).contains?.(container)) {
          cleanupCurrentMount();
          return;
        }
      }
    }
  });

  // Start observing once container is in the DOM
  requestAnimationFrame(() => {
    const parent = container.parentElement;
    if (parent) {
      observer.observe(parent, { childList: true });
    }
  });

  currentMount = { root, container, observer };
  return container;
}

/** Unmounts the current React root and disconnects the observer. */
export function cleanupCurrentMount(): void {
  if (!currentMount) return;
  const { root, observer } = currentMount;
  observer.disconnect();
  root.unmount();
  currentMount = null;
}

/**
 * Returns the current mount state. Useful for testing and debugging.
 * Returns null if no React route is currently mounted.
 */
export function getCurrentMount(): MountedRoute | null {
  return currentMount;
}
