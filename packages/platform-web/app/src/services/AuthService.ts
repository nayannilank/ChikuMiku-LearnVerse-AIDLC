/**
 * AuthService — Authentication service layer for the LearnVerse web application.
 *
 * This module delegates to the central API client (./api.ts) which provides:
 * - JWT token management with auto-refresh on 401
 * - Exponential backoff retry logic for 5xx errors (max 3 retries)
 * - Typed error handling
 *
 * The ServiceResult interface is preserved for backward compatibility with
 * existing screen components.
 */

import type {
  UserRole,
  ServiceResult,
  LoginSuccessData,
  ParentRegistrationRequest,
  StudentRegistrationRequest,
} from '../types/auth';
import { escapeHtml } from '../utils/escapeHtml';
import { authApi, setTokens, ApiClientError } from './api';

export interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Re-export API_BASE for backward compatibility.
 */
export { API_BASE_URL as API_BASE } from './api';

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
    const response = await authApi.login(username, password, 'student');
    setTokens(response.accessToken, response.refreshToken);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? err.message
        : 'Unable to connect. Please check your internet connection.';
    return { success: false, error: message };
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
  try {
    const response = await authApi.login(username, password, role);
    setTokens(response.accessToken, response.refreshToken);
    return {
      success: true,
      data: { token: response.accessToken, username: response.username },
    };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? escapeHtml(err.message)
        : escapeHtml('Unable to connect. Please check your internet connection.');
    return { success: false, error: message };
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
  try {
    await authApi.registerParent(data);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? escapeHtml(err.message)
        : escapeHtml('Unable to connect. Please check your internet connection.');
    return { success: false, error: message };
  }
}

/**
 * Registers a new student account. Requires parent authentication token.
 *
 * @param data - The student registration form data
 * @param _token - Deprecated: token is now managed by the central API client
 * @returns A ServiceResult indicating success or failure
 */
export async function registerStudent(
  data: StudentRegistrationRequest,
  _token: string
): Promise<ServiceResult> {
  try {
    await authApi.registerStudent({
      parentUsername: data.parentUsername,
      studentUsername: data.studentUsername,
      name: data.name,
      password: '', // Password should be added to the StudentRegistrationRequest type
      grade: data.grade,
      schoolName: data.schoolName,
      subjects: [],
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? escapeHtml(err.message)
        : escapeHtml('Unable to connect. Please check your internet connection.');
    return { success: false, error: message };
  }
}

/**
 * Requests a password reset. Sends OTP to email and phone.
 *
 * @param identifier - The parent email address
 * @returns A ServiceResult indicating success or failure
 */
export async function forgotPassword(
  identifier: string
): Promise<ServiceResult> {
  try {
    // The new API expects email + phone; use identifier for both
    // until the UI is updated to collect both fields
    await authApi.forgotPassword(identifier, '');
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? escapeHtml(err.message)
        : escapeHtml('Unable to connect. Please check your internet connection.');
    return { success: false, error: message };
  }
}

/**
 * Resets a user's password using a token from the OTP verification.
 *
 * @param token - The password reset token
 * @param newPassword - The new password to set
 * @returns A ServiceResult indicating success or failure
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ServiceResult> {
  try {
    await authApi.resetPassword(token, newPassword);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiClientError
        ? escapeHtml(err.message)
        : escapeHtml('Unable to connect. Please check your internet connection.');
    return { success: false, error: message };
  }
}
