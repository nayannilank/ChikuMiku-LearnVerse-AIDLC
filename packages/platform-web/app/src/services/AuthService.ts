export interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Base URL for the API. Configured via the VITE_API_BASE environment variable.
 * Defaults to http://localhost:3000 in development.
 *
 * Vite statically replaces import.meta.env.VITE_API_BASE at build time.
 * The type assertion is safe because Vite handles the substitution.
 */
export const API_BASE: string =
  ((import.meta as unknown as Record<string, Record<string, string>>).env
    ?.VITE_API_BASE as string | undefined) || 'http://localhost:3000';

/**
 * Authenticates a user against the LearnVerse API.
 *
 * @param username - The user's username
 * @param password - The user's password
 * @returns A LoginResult indicating success or failure with an error message
 */
export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      return { success: true };
    }

    // Attempt to extract error message from the response body
    let errorMessage = 'Login failed. Please try again.';
    try {
      const data = await response.json();
      errorMessage = data.message || data.error || errorMessage;
    } catch {
      // Response body wasn't valid JSON; use fallback message
    }

    return { success: false, error: errorMessage };
  } catch {
    return {
      success: false,
      error: 'Unable to connect. Please check your internet connection.',
    };
  }
}
