import {useAuthContext} from '../context/AuthContext';
import type {AuthContextValue} from '../context/AuthContext';

/**
 * Hook to access authentication state and actions.
 *
 * Exposes:
 * - isAuthenticated: whether a valid token exists
 * - isLoading: whether auth initialization or an auth action is in progress
 * - error: the last error message, or null
 * - unsavedInputError: error when preserving input on session expiry fails, or null
 * - login(username, password): authenticate with credentials
 * - registerParent(data): register a parent account
 * - registerStudent(data): register a student account (auto-login on success)
 * - logout(): clear stored token and reset auth state
 * - sessionExpiredLogout(unsavedInput?): handle session expiry with input preservation
 * - dismissUnsavedInputError(): dismiss the unsaved input error and proceed
 *
 * This is a convenience alias for useAuthContext(). Both can be used
 * interchangeably; useAuth provides a shorter import path.
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}
