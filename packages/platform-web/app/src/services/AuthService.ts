import type {
  UserRole,
  ServiceResult,
  LoginSuccessData,
  ParentRegistrationRequest,
  StudentRegistrationRequest,
} from '../types/auth';
import { escapeHtml } from '../utils/escapeHtml';

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
 * Configurable mock delay in milliseconds to simulate network latency.
 * Used by mock responses until the backend is implemented.
 */
const MOCK_DELAY_MS = 500;

/**
 * Whether to use mock responses instead of real API calls.
 * Set to `false` once the backend is ready.
 */
const USE_MOCKS = true;

/**
 * Simulates network latency for mock responses.
 */
function delay(ms: number = MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handles HTTP error responses uniformly for all new service functions.
 *
 * - 4xx → business error from response body (escaped for DOM safety)
 * - 5xx → generic "Something went wrong" message
 * - Network failure → "Unable to connect" message
 */
async function handleErrorResponse(
  response: Response
): Promise<ServiceResult<never>> {
  if (response.status >= 500) {
    return {
      success: false,
      error: escapeHtml('Something went wrong. Please try again.'),
    };
  }

  // 4xx — attempt to extract business error from response body
  let errorMessage = 'Request failed. Please try again.';
  try {
    const data = await response.json();
    errorMessage = data.message || data.error || errorMessage;
  } catch {
    // Response body wasn't valid JSON; use fallback message
  }

  return { success: false, error: escapeHtml(errorMessage) };
}

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

/**
 * Authenticates a user with a specific role against the LearnVerse API.
 *
 * @param username - The user's username
 * @param password - The user's password
 * @param role - The role to authenticate as ("parent" or "student")
 * @returns A ServiceResult containing login data on success or an error message on failure
 */
export async function loginWithRole(
  username: string,
  password: string,
  role: UserRole
): Promise<ServiceResult<LoginSuccessData>> {
  if (USE_MOCKS) {
    await delay();
    return {
      success: true,
      data: { token: `mock-token-${role}-${Date.now()}`, username },
    };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data: { token: data.token, username: data.username } };
    }

    return handleErrorResponse(response);
  } catch {
    return {
      success: false,
      error: escapeHtml('Unable to connect. Please check your internet connection.'),
    };
  }
}

/**
 * Registers a new parent account.
 *
 * @param data - The parent registration form data
 * @returns A ServiceResult indicating success or failure
 */
export async function registerParent(
  data: ParentRegistrationRequest
): Promise<ServiceResult> {
  if (USE_MOCKS) {
    await delay();
    return { success: true };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/register/parent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      return { success: true };
    }

    return handleErrorResponse(response);
  } catch {
    return {
      success: false,
      error: escapeHtml('Unable to connect. Please check your internet connection.'),
    };
  }
}

/**
 * Registers a new student account. Requires parent authentication token.
 *
 * @param data - The student registration form data
 * @param token - The parent's authentication token for the Authorization header
 * @returns A ServiceResult indicating success or failure
 */
export async function registerStudent(
  data: StudentRegistrationRequest,
  token: string
): Promise<ServiceResult> {
  if (USE_MOCKS) {
    await delay();
    return { success: true };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/register/student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      return { success: true };
    }

    return handleErrorResponse(response);
  } catch {
    return {
      success: false,
      error: escapeHtml('Unable to connect. Please check your internet connection.'),
    };
  }
}

/**
 * Requests a password reset link. The link is sent to the parent's registered email
 * for both parent and student accounts.
 *
 * @param identifier - The parent username or email address
 * @returns A ServiceResult indicating success or failure
 */
export async function forgotPassword(
  identifier: string
): Promise<ServiceResult> {
  if (USE_MOCKS) {
    await delay();
    return { success: true };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });

    if (response.ok) {
      return { success: true };
    }

    return handleErrorResponse(response);
  } catch {
    return {
      success: false,
      error: escapeHtml('Unable to connect. Please check your internet connection.'),
    };
  }
}

/**
 * Resets a user's password using a token from the reset link.
 *
 * @param token - The password reset token from the URL
 * @param newPassword - The new password to set
 * @returns A ServiceResult indicating success or failure
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ServiceResult> {
  if (USE_MOCKS) {
    await delay();
    return { success: true };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (response.ok) {
      return { success: true };
    }

    return handleErrorResponse(response);
  } catch {
    return {
      success: false,
      error: escapeHtml('Unable to connect. Please check your internet connection.'),
    };
  }
}
