/**
 * Account lockout logic.
 *
 * Locks an account for 15 minutes after 3 consecutive failed login attempts.
 * Resets the failure counter on successful authentication.
 * Notifies the registered contact on lockout.
 *
 * Requirements: 8.5
 */

// --- Constants ---

/** Maximum consecutive failed attempts before lockout */
export const MAX_FAILED_ATTEMPTS = 3;

/** Lockout duration in milliseconds (15 minutes) */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// --- Types ---

/**
 * Tracks failed login attempts and lockout state for a contact.
 */
export interface LockoutRecord {
  contactValue: string;
  consecutiveFailures: number;
  lockedUntil: Date | null;
  lastFailureAt: Date | null;
}

/**
 * Notification callback interface for lockout events.
 * Implementations can send email, SMS, push notifications, etc.
 */
export interface LockoutNotifier {
  /**
   * Called when an account is locked due to consecutive failed attempts.
   * @param contactType - 'email' or 'phone'
   * @param contactValue - The email address or phone number to notify
   * @param lockedUntil - When the lockout expires
   */
  notifyLockout(
    contactType: 'email' | 'phone',
    contactValue: string,
    lockedUntil: Date
  ): void;
}

// --- In-Memory Lockout Store ---

const lockoutStore = new Map<string, LockoutRecord>();

/** Registered notifier (optional). */
let lockoutNotifier: LockoutNotifier | null = null;

// --- Public API ---

/**
 * Registers a notifier to be called when accounts are locked.
 */
export function setLockoutNotifier(notifier: LockoutNotifier | null): void {
  lockoutNotifier = notifier;
}

/**
 * Returns the currently registered lockout notifier.
 */
export function getLockoutNotifier(): LockoutNotifier | null {
  return lockoutNotifier;
}

/**
 * Clears all lockout records. Useful for test isolation.
 */
export function clearLockoutStore(): void {
  lockoutStore.clear();
}

/**
 * Gets the lockout record for a contact value.
 * Returns undefined if no record exists.
 */
export function getLockoutRecord(contactValue: string): LockoutRecord | undefined {
  return lockoutStore.get(contactValue);
}

/**
 * Checks whether an account is currently locked.
 * @param contactValue - The contact to check
 * @param now - Optional current time (for testing)
 * @returns true if the account is locked, false otherwise
 */
export function isAccountLocked(contactValue: string, now?: Date): boolean {
  const record = lockoutStore.get(contactValue);
  if (!record || !record.lockedUntil) {
    return false;
  }
  const currentTime = now ?? new Date();
  if (currentTime.getTime() >= record.lockedUntil.getTime()) {
    // Lockout has expired — clear it
    record.lockedUntil = null;
    record.consecutiveFailures = 0;
    return false;
  }
  return true;
}

/**
 * Records a failed login attempt for a contact.
 * If this is the 3rd consecutive failure, locks the account for 15 minutes
 * and notifies the registered contact.
 *
 * @param contactValue - The contact that failed to authenticate
 * @param contactType - 'email' or 'phone' (for notification)
 * @param now - Optional current time (for testing)
 * @returns The updated lockout record
 */
export function recordFailedAttempt(
  contactValue: string,
  contactType: 'email' | 'phone',
  now?: Date
): LockoutRecord {
  const currentTime = now ?? new Date();

  let record = lockoutStore.get(contactValue);
  if (!record) {
    record = {
      contactValue,
      consecutiveFailures: 0,
      lockedUntil: null,
      lastFailureAt: null,
    };
    lockoutStore.set(contactValue, record);
  }

  record.consecutiveFailures += 1;
  record.lastFailureAt = currentTime;

  if (record.consecutiveFailures >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(currentTime.getTime() + LOCKOUT_DURATION_MS);
    record.lockedUntil = lockedUntil;

    // Notify the registered contact
    if (lockoutNotifier) {
      lockoutNotifier.notifyLockout(contactType, contactValue, lockedUntil);
    }
  }

  return { ...record };
}

/**
 * Resets the failure counter for a contact.
 * Called on successful authentication (Requirement 8.5).
 *
 * @param contactValue - The contact that successfully authenticated
 */
export function resetFailureCounter(contactValue: string): void {
  const record = lockoutStore.get(contactValue);
  if (record) {
    record.consecutiveFailures = 0;
    record.lockedUntil = null;
    record.lastFailureAt = null;
  }
}
