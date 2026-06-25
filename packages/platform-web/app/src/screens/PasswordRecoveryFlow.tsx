/**
 * PasswordRecoveryFlow — React component for the LearnVerse password recovery page.
 *
 * Implements a 3-step flow:
 *   Step 1: Email + phone number submission to request OTP
 *   Step 2: Dual OTP verification (email + phone) with 10-min expiry timer
 *   Step 3: New password creation with complexity validation
 *
 * Validates: Requirements 1.31, 1.32, 1.33, 1.34, 1.35, 1.36, 1.37, 1.38
 */

import React, { useState, useCallback, useEffect, useRef, type FormEvent } from 'react';

export interface PasswordRecoveryFlowProps {
  onForgotPassword: (email: string, phone: string) => Promise<{ otpSessionId: string }>;
  onVerifyOtp: (otpSessionId: string, emailOtp: string, phoneOtp: string) => Promise<{ resetToken: string }>;
  onResetPassword: (resetToken: string, newPassword: string) => Promise<void>;
  onBackToLogin: () => void;
}

type Step = 1 | 2 | 3;

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  errorBg: '#FDF2F2',
  success: '#27AE60',
  successBg: '#F0FFF4',
  muted: '#6B7280',
} as const;

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

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
    maxWidth: '420px',
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

  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '20px',
  } as React.CSSProperties,

  progressStep: (isActive: boolean, isCompleted: boolean): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: isCompleted ? COLORS.success : isActive ? COLORS.primary : COLORS.border,
    color: isActive || isCompleted ? COLORS.white : COLORS.muted,
    transition: 'background-color 0.2s, color 0.2s',
  }),

  progressLine: (isCompleted: boolean): React.CSSProperties => ({
    width: '32px',
    height: '2px',
    backgroundColor: isCompleted ? COLORS.success : COLORS.border,
    transition: 'background-color 0.2s',
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

  backLink: {
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
    marginBottom: '14px',
    fontSize: '11px',
    color: COLORS.error,
  } as React.CSSProperties,

  successArea: {
    backgroundColor: COLORS.successBg,
    border: `1px solid ${COLORS.success}`,
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '14px',
    fontSize: '11px',
    color: COLORS.success,
  } as React.CSSProperties,

  timerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  } as React.CSSProperties,

  timerText: (isExpired: boolean): React.CSSProperties => ({
    fontSize: '12px',
    fontWeight: 600,
    color: isExpired ? COLORS.error : COLORS.muted,
  }),

  resendButton: (isEnabled: boolean): React.CSSProperties => ({
    fontSize: '11px',
    fontWeight: 600,
    color: isEnabled ? COLORS.primary : COLORS.muted,
    cursor: isEnabled ? 'pointer' : 'not-allowed',
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    opacity: isEnabled ? 1 : 0.5,
  }),

  complexityIndicator: {
    display: 'flex',
    gap: '4px',
    marginTop: '6px',
    marginBottom: '4px',
  } as React.CSSProperties,

  complexityBar: (isActive: boolean, color: string): React.CSSProperties => ({
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    backgroundColor: isActive ? color : COLORS.border,
    transition: 'background-color 0.2s',
  }),

  complexityLabel: (color: string): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 500,
    color,
    marginBottom: '8px',
  }),
} as const;

/**
 * Evaluates password complexity and returns a strength level.
 */
function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: COLORS.muted };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: 'Weak', color: COLORS.error };
  if (score <= 3) return { level: 2, label: 'Fair', color: '#F39C12' };
  if (score <= 4) return { level: 3, label: 'Good', color: COLORS.secondary };
  return { level: 4, label: 'Strong', color: COLORS.success };
}

/**
 * Validates password meets complexity requirements:
 * 8-20 chars, uppercase, lowercase, number, special character.
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 20) return 'Password must be at most 20 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

/**
 * Formats seconds into MM:SS display string.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * PasswordRecoveryFlow React component.
 *
 * Renders a multi-step password recovery form with OTP verification,
 * countdown timer, and password complexity validation.
 */
export const PasswordRecoveryFlow: React.FC<PasswordRecoveryFlowProps> = ({
  onForgotPassword,
  onVerifyOtp,
  onResetPassword,
  onBackToLogin,
}) => {
  // Flow state
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 1 state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 state
  const [otpSessionId, setOtpSessionId] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(OTP_EXPIRY_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Timer management
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining(OTP_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isTimerExpired = timeRemaining === 0;

  // Step 1: Request OTP
  const handleRequestOtp = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedEmail = email.trim();
      const trimmedPhone = phone.trim();

      if (!trimmedEmail || !trimmedPhone) {
        setError('Please enter both email and phone number.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await onForgotPassword(trimmedEmail, trimmedPhone);
        setOtpSessionId(result.otpSessionId);
        setStep(2);
        startTimer();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        if (message.toLowerCase().includes('404') || message.toLowerCase().includes('not found') || message.toLowerCase().includes('no account')) {
          setError('No account found with this email and phone.');
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [email, phone, onForgotPassword, startTimer],
  );

  // Step 2: Verify OTP
  const handleVerifyOtp = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedEmailOtp = emailOtp.trim();
      const trimmedPhoneOtp = phoneOtp.trim();

      if (!trimmedEmailOtp || !trimmedPhoneOtp) {
        setError('Please enter both OTP codes.');
        return;
      }

      if (isTimerExpired) {
        setError('OTP has expired. Please request a new one.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await onVerifyOtp(otpSessionId, trimmedEmailOtp, trimmedPhoneOtp);
        setResetToken(result.resetToken);
        setStep(3);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError('Invalid or expired OTP.');
        void message; // consumed for type safety
      } finally {
        setIsLoading(false);
      }
    },
    [emailOtp, phoneOtp, otpSessionId, onVerifyOtp, isTimerExpired],
  );

  // Step 2: Resend OTP
  const handleResendOtp = useCallback(async () => {
    if (!isTimerExpired) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await onForgotPassword(email.trim(), phone.trim());
      setOtpSessionId(result.otpSessionId);
      setEmailOtp('');
      setPhoneOtp('');
      startTimer();
      setSuccessMessage('New OTP sent successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isTimerExpired, email, phone, onForgotPassword, startTimer]);

  // Step 3: Reset Password
  const handleResetPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setIsLoading(true);
      try {
        await onResetPassword(resetToken, newPassword);
        setResetSuccess(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [newPassword, confirmPassword, resetToken, onResetPassword],
  );

  const handleBackToLogin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onBackToLogin();
    },
    [onBackToLogin],
  );

  const passwordStrength = getPasswordStrength(newPassword);

  // Progress indicator
  const renderProgress = () => (
    <div style={styles.progressContainer} role="group" aria-label={`Step ${step} of 3`}>
      <div style={styles.progressStep(step === 1, step > 1)} aria-current={step === 1 ? 'step' : undefined}>
        {step > 1 ? '✓' : '1'}
      </div>
      <div style={styles.progressLine(step > 1)} aria-hidden="true" />
      <div style={styles.progressStep(step === 2, step > 2)} aria-current={step === 2 ? 'step' : undefined}>
        {step > 2 ? '✓' : '2'}
      </div>
      <div style={styles.progressLine(step > 2)} aria-hidden="true" />
      <div style={styles.progressStep(step === 3, false)} aria-current={step === 3 ? 'step' : undefined}>
        3
      </div>
    </div>
  );

  // Step 1: Email + Phone form
  const renderStep1 = () => (
    <form onSubmit={handleRequestOtp} noValidate aria-label="Request OTP form">
      <div style={styles.fieldGroup}>
        <label htmlFor="recovery-email" style={styles.label}>
          Email Address
        </label>
        <input
          id="recovery-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          style={styles.input}
          aria-required="true"
          placeholder="Enter your registered email"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label htmlFor="recovery-phone" style={styles.label}>
          Phone Number
        </label>
        <input
          id="recovery-phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isLoading}
          style={styles.input}
          aria-required="true"
          placeholder="Enter your registered phone number"
        />
      </div>

      <button
        type="submit"
        style={styles.submitButton(isLoading)}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'Sending...' : 'Send OTP'}
      </button>
    </form>
  );

  // Step 2: Dual OTP verification
  const renderStep2 = () => (
    <form onSubmit={handleVerifyOtp} noValidate aria-label="Verify OTP form">
      <div style={styles.fieldGroup}>
        <label htmlFor="recovery-email-otp" style={styles.label}>
          Email OTP
        </label>
        <input
          id="recovery-email-otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          name="emailOtp"
          autoComplete="one-time-code"
          value={emailOtp}
          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={isLoading}
          style={styles.input}
          aria-required="true"
          placeholder="6-digit code from email"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label htmlFor="recovery-phone-otp" style={styles.label}>
          Phone OTP
        </label>
        <input
          id="recovery-phone-otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          name="phoneOtp"
          autoComplete="one-time-code"
          value={phoneOtp}
          onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={isLoading}
          style={styles.input}
          aria-required="true"
          placeholder="6-digit code from phone"
        />
      </div>

      <div style={styles.timerContainer}>
        <span style={styles.timerText(isTimerExpired)} aria-live="polite" aria-atomic="true">
          {isTimerExpired ? 'OTP expired' : `Time remaining: ${formatTime(timeRemaining)}`}
        </span>
        <button
          type="button"
          style={styles.resendButton(!isTimerExpired ? false : true)}
          onClick={handleResendOtp}
          disabled={!isTimerExpired || isLoading}
          aria-label="Resend OTP"
        >
          Resend OTP
        </button>
      </div>

      <button
        type="submit"
        style={styles.submitButton(isLoading)}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'Verifying...' : 'Verify OTPs'}
      </button>
    </form>
  );

  // Step 3: New password
  const renderStep3 = () => {
    if (resetSuccess) {
      return (
        <div>
          <div style={styles.successArea} role="status" aria-live="polite">
            Password reset successfully! You can now log in with your new password.
          </div>
          <button
            type="button"
            style={styles.submitButton(false)}
            onClick={handleBackToLogin}
          >
            Back to Login
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleResetPassword} noValidate aria-label="Reset password form">
        <div style={styles.fieldGroup}>
          <label htmlFor="recovery-new-password" style={styles.label}>
            New Password
          </label>
          <input
            id="recovery-new-password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            style={styles.input}
            aria-required="true"
            aria-describedby="password-complexity"
            placeholder="Enter new password"
          />
          {newPassword && (
            <>
              <div style={styles.complexityIndicator} id="password-complexity" aria-label={`Password strength: ${passwordStrength.label}`}>
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    style={styles.complexityBar(level <= passwordStrength.level, passwordStrength.color)}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span style={styles.complexityLabel(passwordStrength.color)}>
                {passwordStrength.label}
              </span>
            </>
          )}
        </div>

        <div style={styles.fieldGroup}>
          <label htmlFor="recovery-confirm-password" style={styles.label}>
            Confirm Password
          </label>
          <input
            id="recovery-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            style={styles.input}
            aria-required="true"
            placeholder="Confirm new password"
          />
        </div>

        <button
          type="submit"
          style={styles.submitButton(isLoading)}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Password Recovery</h2>
        <p style={styles.subtitle}>
          {step === 1 && 'Enter your registered email and phone number'}
          {step === 2 && 'Enter the OTP codes sent to your email and phone'}
          {step === 3 && (resetSuccess ? 'Your password has been reset' : 'Create your new password')}
        </p>

        {renderProgress()}

        {error && (
          <div style={styles.errorArea} role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {successMessage && (
          <div style={styles.successArea} role="status" aria-live="polite">
            {successMessage}
          </div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Back to Login link — visible on all steps */}
        {!resetSuccess && (
          <button
            type="button"
            style={styles.backLink}
            onClick={handleBackToLogin}
            aria-label="Back to Login"
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordRecoveryFlow;
