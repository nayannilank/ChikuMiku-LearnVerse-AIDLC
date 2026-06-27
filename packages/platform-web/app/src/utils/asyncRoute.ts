/**
 * Async Route Container — Manages the loading → fetch → mount lifecycle
 * for all data-fetching route handlers in the hash router.
 *
 * Creates an HTMLElement that:
 * 1. Immediately shows a loading indicator inside ResponsiveLayout
 * 2. Calls the async factory to fetch data and create the React element
 * 3. On success: replaces loading with the mounted React screen
 * 4. On 401: clears tokens and redirects to #login
 * 5. On other errors: shows error view with retry button
 *
 * This utility centralizes the async route pattern to avoid duplication
 * across the 14+ route handlers.
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 */

import { type ReactElement } from 'react';
import { renderReactRoute } from './reactBridge';
import { wrapInResponsiveLayout } from './wrapInResponsiveLayout';
import { clearTokens } from '../services/api';
import { createLoadingView } from '../components/LoadingView';
import { createErrorView } from '../components/ErrorView';
import { TreeSidebarProps } from '../components/TreeSidebar';

/** Options for the async route container. */
export interface AsyncRouteOptions {
  /** Optional TreeSidebar props for hierarchical navigation in the layout. */
  treeSidebar?: TreeSidebarProps;
}

/**
 * Creates an HTMLElement that orchestrates the loading → fetch → mount lifecycle.
 *
 * The returned element immediately displays a loading indicator wrapped in the
 * responsive layout. Once the async factory resolves, the loading state is replaced
 * with the rendered React screen. On errors:
 * - 401: tokens are cleared and the user is redirected to #login
 * - Network/5xx: an error view with a retry button is shown
 *
 * @param activeRoute - The current hash route string for sidebar/nav highlighting.
 * @param factory - An async function that fetches data and returns a React element.
 * @param options - Optional configuration (e.g., tree sidebar props).
 * @returns An HTMLElement that manages its own async lifecycle.
 */
export function createAsyncRouteContainer(
  activeRoute: string,
  factory: () => Promise<ReactElement>,
  options?: AsyncRouteOptions
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'async-route-wrapper';

  // Show loading initially wrapped in responsive layout
  const loadingEl = createLoadingView();
  wrapper.appendChild(
    wrapInResponsiveLayout(loadingEl, activeRoute, options?.treeSidebar)
  );

  // Execute async factory
  factory()
    .then((element) => {
      wrapper.innerHTML = '';
      const rendered = renderReactRoute(element);
      wrapper.appendChild(
        wrapInResponsiveLayout(rendered, activeRoute, options?.treeSidebar)
      );
    })
    .catch((err: unknown) => {
      const error = err as { status?: number; message?: string } | null;

      // Handle 401 — clear tokens and redirect to login
      if (error?.status === 401) {
        clearTokens();
        window.location.hash = '#login';
        return;
      }

      // Handle network/5xx errors — show error view with retry
      wrapper.innerHTML = '';
      const errorMessage = error?.message || 'Something went wrong. Please try again.';
      const errorEl = createErrorView(errorMessage, () => {
        // Retry: replace with fresh async container
        wrapper.innerHTML = '';
        const retryContainer = createAsyncRouteContainer(activeRoute, factory, options);
        wrapper.appendChild(retryContainer);
      });
      wrapper.appendChild(
        wrapInResponsiveLayout(errorEl, activeRoute, options?.treeSidebar)
      );
    });

  return wrapper;
}
