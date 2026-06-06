/**
 * Authentication field validation functions.
 *
 * Validators for username, password, email, and phone fields used in
 * registration and login flows. Each validator returns a ValidationResponse
 * with a boolean `valid` flag and an optional `error` message.
 *
 * Requirements: 2.1, 3.2, 3.3, 3.8, 3.9
 */

// --- Validation Response Type ---

export interface ValidationResponse {
  valid: boolean;
  error?: string;
}

// --- Username Validation ---

/** Minimum username length */
const USERNAME_MIN_LENGTH = 5;
/** Maximum username length */
const USERNAME_MAX_LENGTH = 15;
/** Username allowed characters pattern: alphanumeric, underscores, hyphens */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates a username meets the requirements:
 * - Between 5 and 15 characters inclusive
 * - Contains only alphanumeric characters, underscores, and hyphens
 */
export function validateUsername(username: string): ValidationResponse {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string' };
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must not exceed ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      error: 'Username must contain only alphanumeric characters, underscores, and hyphens',
    };
  }

  return { valid: true };
}

// --- Password Validation ---

/** Minimum password length */
const PASSWORD_MIN_LENGTH = 8;
/** Maximum password length */
const PASSWORD_MAX_LENGTH = 20;

/**
 * Validates a password meets the requirements:
 * - Between 8 and 20 characters inclusive
 * - Contains at least one uppercase letter (A-Z)
 * - Contains at least one lowercase letter (a-z)
 * - Contains at least one digit (0-9)
 * - Contains at least one special character (not alphanumeric and not whitespace)
 */
export function validatePassword(password: string): ValidationResponse {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one digit',
    };
  }

  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one special character',
    };
  }

  return { valid: true };
}

// --- Email Validation ---

/** Maximum email length per RFC 5321 */
const EMAIL_MAX_LENGTH = 254;

/**
 * Validates an email address:
 * - Non-empty
 * - Maximum 254 characters
 * - Contains '@' followed by a domain with at least one dot
 */
export function validateEmail(email: string): ValidationResponse {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }

  if (email.length === 0) {
    return { valid: false, error: 'Email must not be empty' };
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return {
      valid: false,
      error: `Email must not exceed ${EMAIL_MAX_LENGTH} characters`,
    };
  }

  // Must contain '@' with a non-empty local part and a domain containing a dot
  const atIndex = email.indexOf('@');
  if (atIndex < 1) {
    return {
      valid: false,
      error: 'Email must contain "@" with a valid local part',
    };
  }

  const domain = email.slice(atIndex + 1);
  if (domain.length === 0 || !domain.includes('.')) {
    return {
      valid: false,
      error: 'Email must contain a domain with at least one dot after "@"',
    };
  }

  return { valid: true };
}

// --- Phone Validation ---

/** Phone number must be exactly 10 digits */
const PHONE_EXACT_DIGITS = 10;
/** Pattern for exactly 10 digits */
const PHONE_PATTERN = /^\d{10}$/;

/**
 * Validates a phone number:
 * - Exactly 10 digits
 * - No country code or other characters
 */
export function validatePhone(phone: string): ValidationResponse {
  if (typeof phone !== 'string') {
    return { valid: false, error: 'Phone number must be a string' };
  }

  if (!PHONE_PATTERN.test(phone)) {
    return {
      valid: false,
      error: `Phone number must be exactly ${PHONE_EXACT_DIGITS} digits with no other characters`,
    };
  }

  return { valid: true };
}
