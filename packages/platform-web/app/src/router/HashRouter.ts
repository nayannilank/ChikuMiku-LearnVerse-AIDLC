/**
 * Hash-based router for the LearnVerse web application.
 *
 * Listens to `hashchange` events and initial page load to render the
 * appropriate view into a single mount point. Falls back to the home view
 * for unrecognized hashes.
 *
 * @module HashRouter
 * @see Requirements 12.4
 */

/** A route definition mapping a URL hash pattern to a view factory. */
export interface Route {
  /** RegExp tested against the hash string (without leading `#`). */
  pattern: RegExp;
  /** Factory that receives extracted params and returns the view element. */
  handler: (params: Record<string, string>) => HTMLElement;
}

/** Configuration options for `createRouter`. */
export interface RouterOptions {
  /** The DOM element where views will be mounted. */
  mountPoint: HTMLElement;
  /** Ordered list of routes; first match wins. */
  routes: Route[];
  /** Factory for the fallback view rendered when no route matches. */
  fallback: () => HTMLElement;
}

/**
 * Extract named capture groups and query-string parameters from a hash string.
 *
 * Named groups from the regex match take precedence. Query params (e.g.,
 * `reset-password?token=abc`) are merged in as well so handlers can access
 * values like `params.token`.
 */
function extractParams(hash: string, match: RegExpMatchArray): Record<string, string> {
  const params: Record<string, string> = {};

  // Extract named capture groups from the regex match
  if (match.groups) {
    for (const [key, value] of Object.entries(match.groups)) {
      if (value !== undefined) {
        params[key] = value;
      }
    }
  }

  // Extract query parameters from the hash (e.g., "reset-password?token=abc&foo=bar")
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = hash.slice(queryIndex + 1);
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      // Named groups take precedence over query params
      if (!(key in params)) {
        params[key] = value;
      }
    });
  }

  return params;
}

/**
 * Create a hash-based router that renders views into a mount point.
 *
 * The router immediately renders the view for the current hash on creation,
 * then listens for `hashchange` events to swap views without full page reloads.
 *
 * @returns An object with a `destroy` method that removes the event listener.
 */
export function createRouter(options: RouterOptions): { destroy: () => void } {
  const { mountPoint, routes, fallback } = options;

  function render(): void {
    // Get the raw hash without the leading `#`
    const rawHash = window.location.hash.slice(1) || '';

    let element: HTMLElement | null = null;

    // Try each route in order; first match wins
    for (const route of routes) {
      const match = rawHash.match(route.pattern);
      if (match) {
        const params = extractParams(rawHash, match);
        element = route.handler(params);
        break;
      }
    }

    // Fall back to the home view if no route matched
    if (!element) {
      element = fallback();
    }

    // Clear mount point and append the new view
    mountPoint.innerHTML = '';
    mountPoint.appendChild(element);
  }

  // Listen for hash changes
  window.addEventListener('hashchange', render);

  // Render the initial view immediately
  render();

  return {
    destroy(): void {
      window.removeEventListener('hashchange', render);
    },
  };
}
