/**
 * Session Expiry Interceptor
 *
 * Wraps API fetch calls to detect 401 (Unauthorized) responses,
 * indicating that the session token has expired or become invalid.
 * When a 401 is detected, it triggers the session expiry handler
 * which preserves unsaved input and redirects to the auth screen.
 *
 * Requirements: 1.3, 1.6
 */

/**
 * Callback type for handling session expiry.
 * Called when a 401 response is detected from an API call.
 */
export type SessionExpiredHandler = () => void;

/**
 * Listener reference that can be used to unsubscribe.
 */
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/**
 * Registers a handler to be called when session expiry is detected.
 * Only one handler can be active at a time (the latest overwrites previous).
 *
 * @param handler - Function to invoke on session expiry
 */
export function onSessionExpired(handler: SessionExpiredHandler): void {
  sessionExpiredHandler = handler;
}

/**
 * Removes the current session expiry handler.
 */
export function clearSessionExpiredHandler(): void {
  sessionExpiredHandler = null;
}

/**
 * Creates a fetch wrapper that intercepts 401 responses and triggers
 * the session expiry flow. Non-401 responses pass through normally.
 *
 * This interceptor should be used for all authenticated API calls
 * (not for login/register calls which are pre-authentication).
 *
 * @param token - The current session token for Authorization header
 * @returns A fetch-like function that intercepts 401 responses
 */
export function createAuthenticatedFetch(token: string) {
  return async function authenticatedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Session expired or token invalid — trigger handler
      if (sessionExpiredHandler) {
        sessionExpiredHandler();
      }
      // Still return the response so callers can handle it if needed
    }

    return response;
  };
}

/**
 * Checks if a fetch Response indicates session expiry (401 Unauthorized).
 * Can be used as a standalone check in existing API call patterns.
 *
 * @param response - The fetch Response object
 * @returns true if the response indicates session expiry
 */
export function isSessionExpired(response: Response): boolean {
  return response.status === 401;
}
