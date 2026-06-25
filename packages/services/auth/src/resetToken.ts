/**
 * Reset Token Store
 *
 * In-memory store for password reset tokens with 1-hour TTL.
 * Tokens are 32-byte random hex strings generated with crypto.randomBytes.
 * Production would use PostgreSQL with row-level expiry.
 *
 * Requirements: 3.1, 4.2, 4.3, 4.4
 */

import { randomBytes } from 'crypto';

/** Represents a stored reset token entry. */
export interface ResetTokenEntry {
  token: string;
  username: string;
  accountType: 'parent' | 'student';
  expiresAt: Date;
  used: boolean;
}

/** TTL for reset tokens: 1 hour in milliseconds. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** In-memory store keyed by token string. */
const resetTokenStore = new Map<string, ResetTokenEntry>();

/**
 * Generates a reset token for the given username and account type.
 * The token is a 32-byte random hex string with a 1-hour expiry.
 *
 * @param username - The username requesting the reset
 * @param accountType - Whether the account is a parent or student
 * @returns The generated token string
 */
export function generateResetToken(
  username: string,
  accountType: 'parent' | 'student'
): string {
  const token = randomBytes(32).toString('hex');

  const entry: ResetTokenEntry = {
    token,
    username,
    accountType,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    used: false,
  };

  resetTokenStore.set(token, entry);

  return token;
}

/**
 * Validates a reset token by checking existence, expiry, and usage status.
 *
 * @param token - The token string to validate
 * @returns The token entry if valid and not expired/used, else null
 */
export function validateResetToken(token: string): ResetTokenEntry | null {
  const entry = resetTokenStore.get(token);

  if (!entry) {
    return null;
  }

  if (entry.used) {
    return null;
  }

  if (entry.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return entry;
}

/**
 * Consumes (marks as used) a reset token so it cannot be reused.
 *
 * @param token - The token string to consume
 * @returns true if the token was valid and successfully consumed, false otherwise
 */
export function consumeResetToken(token: string): boolean {
  const entry = validateResetToken(token);

  if (!entry) {
    return false;
  }

  entry.used = true;
  return true;
}

/**
 * Clears the reset token store. Used for test isolation.
 */
export function clearResetTokenStore(): void {
  resetTokenStore.clear();
}
