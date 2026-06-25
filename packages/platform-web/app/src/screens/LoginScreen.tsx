/**
 * LoginScreen — React component for the LearnVerse login page.
 *
 * Displays a role selector (Parent/Learner), username/password fields,
 * a Login button, and a Forgot Password link. Handles loading and error states.
 *
 * Validates: Requirements 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13
 */

import React, { useState, useCallback, useRef, type FormEvent } from 'react';

export interface LoginScreenProps {
  onLogin: (username: string, password: string, role: 'parent' | 'student') => Promise<void>;
  onForgotPassword: () => void;
  error?: string | null;
  isLoading?: boolean;
}

type Role = 'parent' | 'student';

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  errorBg: '#FDF2F2',
  muted: '#6B7280',
} as const;

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  card: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '400px',
  } as React.CSSProperties,

  heading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 4px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  subtitle: {
    fontSize: '13px',
    fontWeight: 400,
    color: COLORS.muted,
    margin: '0 0 20px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  roleSelector: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '20px',
    borderRadius: '22px',
    overflow: 'hidden',
    border: `1px solid ${COLORS.border}`,
  } as React.CSSProperties,

  roleButton: (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: isActive ? COLORS.primary : COLORS.white,
    color: isActive ? COLORS.white : COLORS.dark,
    transition: 'background-color 0.2s, color 0.2s',
  }),

  fieldGroup: {
    marginBottom: '14px',
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '4px',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  submitButton: (isLoading: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '12px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    marginBottom: '14px',
    marginTop: '4px',
  }),

  forgotLink: {
    display: 'block',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: COLORS.primary,
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    width: '100%',
  } as React.CSSProperties,

  errorArea: {
    backgroundColor: COLORS.errorBg,
    border: `1px solid ${COLORS.error}`,
    borderRadius: '8px',
    padding: '10px 12px',
    marginTop: '14px',
    fontSize: '11px',
    color: COLORS.error,
  } as React.CSSProperties,
} as const;

/**
 * LoginScreen React component.
 *
 * Renders the login form with role selection, credential inputs,
 * submit button, forgot password link, and error/loading states.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onForgotPassword,
  error: externalError = null,
  isLoading: externalLoading = false,
}) => {
  const [selectedRole, setSelectedRole] = useState<Role>('parent');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const isLoading = externalLoading || internalLoading;
  const displayError = externalError || internalError;

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setInternalError(null);

      const trimmedUsername = username.trim();

      if (!trimmedUsername || !password) {
        setInternalError('Please enter both username and password.');
        return;
      }

      setInternalLoading(true);

      try {
        await onLogin(trimmedUsername, password, selectedRole);
      } catch (err: unknown) {
        // On login failure: show error, preserve username, clear password (Req 1.12)
        const message =
          err instanceof Error ? err.message : 'incorrect username or password';
        setInternalError(message);
        setPassword('');
        if (passwordInputRef.current) {
          passwordInputRef.current.value = '';
        }
      } finally {
        setInternalLoading(false);
      }
    },
    [username, password, selectedRole, onLogin],
  );

  const handleForgotPassword = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onForgotPassword();
    },
    [onForgotPassword],
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Welcome Back!</h2>
        <p style={styles.subtitle}>Log in to continue learning</p>

        {/* Role selector (Req 1.6) */}
        <div
          style={styles.roleSelector}
          role="radiogroup"
          aria-label="Select your role"
        >
          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'parent'}
            style={styles.roleButton(selectedRole === 'parent')}
            onClick={() => setSelectedRole('parent')}
            disabled={isLoading}
          >
            Parent
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'student'}
            style={styles.roleButton(selectedRole === 'student')}
            onClick={() => setSelectedRole('student')}
            disabled={isLoading}
          >
            Learner
          </button>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} noValidate aria-label="Login form">
          {/* Username field (Req 1.7) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="login-username" style={styles.label}>
              Username
            </label>
            <input
              id="login-username"
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              style={styles.input}
              aria-required="true"
            />
          </div>

          {/* Password field (Req 1.8) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="login-password" style={styles.label}>
              Password
            </label>
            <input
              id="login-password"
              ref={passwordInputRef}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={styles.input}
              aria-required="true"
            />
          </div>

          {/* Login button (Req 1.9) */}
          <button
            type="submit"
            style={styles.submitButton(isLoading)}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        {/* Forgot Password link (Req 1.10) */}
        <button
          type="button"
          style={styles.forgotLink}
          onClick={handleForgotPassword}
          aria-label="Forgot Password?"
        >
          Forgot Password?
        </button>

        {/* Error display (Req 1.12) */}
        {displayError && (
          <div style={styles.errorArea} role="alert" aria-live="assertive">
            {displayError}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
