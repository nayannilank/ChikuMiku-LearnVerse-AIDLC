/**
 * Parental account linking.
 *
 * Allows a parent to view learner progress across all enrolled subjects,
 * reset the learner's password, and update the learner's profile including
 * Grade and registered contact information.
 *
 * Requirements: 8.6
 */

import { Learner, Grade, ContactType, ProgressRecord } from '@learnverse/service-core';
import { addLearnerToStore, findLearnerByContact, hashPassword } from './session';

// --- Parental Account Types ---

/**
 * Represents a parental account that can be linked to one or more learners.
 */
export interface ParentalAccount {
  id: string;
  displayName: string;
  contactType: ContactType;
  contactValue: string;
  linkedLearnerIds: string[];
  createdAt: Date;
}

/**
 * Summary of a learner's progress across all enrolled subjects.
 */
export interface LearnerProgressSummary {
  learnerId: string;
  displayName: string;
  grade: Grade;
  enrolledSubjects: string[];
  progressRecords: ProgressRecord[];
}

/**
 * Result of a profile update operation.
 */
export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
  updatedLearner?: Learner;
}

/**
 * Fields that a parent can update on a learner's profile.
 */
export interface LearnerProfileUpdate {
  grade?: Grade;
  contactType?: ContactType;
  contactValue?: string;
  displayName?: string;
}

// --- In-Memory Stores ---

const parentalAccountStore = new Map<string, ParentalAccount>();
const progressStore = new Map<string, ProgressRecord[]>();
const learnerStoreById = new Map<string, Learner>();

/**
 * Clears all parental stores. Useful for test isolation.
 */
export function clearParentalStore(): void {
  parentalAccountStore.clear();
  progressStore.clear();
  learnerStoreById.clear();
}

// --- Parent Account Management ---

/**
 * Creates a new parental account.
 */
export function createParentalAccount(account: ParentalAccount): void {
  parentalAccountStore.set(account.id, account);
}

/**
 * Retrieves a parental account by ID.
 */
export function getParentalAccount(parentId: string): ParentalAccount | undefined {
  return parentalAccountStore.get(parentId);
}

// --- Learner Registration for Parental Module ---

/**
 * Registers a learner in the parental module's store (for lookup by ID).
 * Also adds to the session store for contact-based lookup.
 */
export function registerLearnerForParental(learner: Learner): void {
  learnerStoreById.set(learner.id, learner);
  addLearnerToStore(learner);
}

/**
 * Retrieves a learner by ID from the parental module's store.
 */
export function getLearnerById(learnerId: string): Learner | undefined {
  return learnerStoreById.get(learnerId);
}

// --- Progress Store ---

/**
 * Adds progress records for a learner (used for testing and by other services).
 */
export function addProgressRecords(learnerId: string, records: ProgressRecord[]): void {
  const existing = progressStore.get(learnerId) ?? [];
  progressStore.set(learnerId, [...existing, ...records]);
}

// --- Link Parent to Learner ---

/**
 * Links a parental account to a learner.
 *
 * - The parent account must exist
 * - The learner must exist
 * - The learner's parentAccountId is updated to reference the parent
 * - The parent's linkedLearnerIds is updated to include the learner
 *
 * Returns true on success, false if parent or learner not found.
 */
export function linkParentToLearner(parentId: string, learnerId: string): boolean {
  const parent = parentalAccountStore.get(parentId);
  if (!parent) {
    return false;
  }

  const learner = learnerStoreById.get(learnerId);
  if (!learner) {
    return false;
  }

  // Avoid duplicate linking
  if (!parent.linkedLearnerIds.includes(learnerId)) {
    parent.linkedLearnerIds.push(learnerId);
  }

  // Update learner's parentAccountId
  learner.parentAccountId = parentId;
  learnerStoreById.set(learnerId, learner);

  return true;
}

// --- View Learner Progress ---

/**
 * Allows a parent to view a learner's progress across all enrolled subjects.
 *
 * - The parent must be linked to the learner
 * - Returns a summary including enrolled subjects and progress records
 *
 * Requirements: 8.6 (parent can view learner progress across all enrolled subjects)
 */
export function viewLearnerProgress(
  parentId: string,
  learnerId: string
): LearnerProgressSummary | null {
  const parent = parentalAccountStore.get(parentId);
  if (!parent) {
    return null;
  }

  // Verify parent is linked to this learner
  if (!parent.linkedLearnerIds.includes(learnerId)) {
    return null;
  }

  const learner = learnerStoreById.get(learnerId);
  if (!learner) {
    return null;
  }

  const records = progressStore.get(learnerId) ?? [];

  return {
    learnerId: learner.id,
    displayName: learner.displayName,
    grade: learner.grade,
    enrolledSubjects: learner.enrolledSubjects,
    progressRecords: records,
  };
}

// --- Reset Learner Password ---

/**
 * Allows a parent to reset the learner's password.
 *
 * - The parent must be linked to the learner
 * - The new password must meet validation requirements (8-128 chars, 1 letter + 1 digit)
 * - Updates the learner's passwordHash
 *
 * Requirements: 8.6 (parent can reset the learner's password)
 */
export function resetLearnerPassword(
  parentId: string,
  learnerId: string,
  newPassword: string
): ProfileUpdateResult {
  const parent = parentalAccountStore.get(parentId);
  if (!parent) {
    return { success: false, error: 'Parent account not found.' };
  }

  if (!parent.linkedLearnerIds.includes(learnerId)) {
    return { success: false, error: 'Parent is not linked to this learner.' };
  }

  const learner = learnerStoreById.get(learnerId);
  if (!learner) {
    return { success: false, error: 'Learner not found.' };
  }

  // Validate password: 8-128 chars, at least 1 letter and 1 digit
  if (newPassword.length < 8 || newPassword.length > 128) {
    return { success: false, error: 'Password must be between 8 and 128 characters.' };
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  if (!hasLetter || !hasDigit) {
    return { success: false, error: 'Password must contain at least one letter and one digit.' };
  }

  // Update password hash
  learner.passwordHash = hashPassword(newPassword);
  learner.updatedAt = new Date();
  learnerStoreById.set(learnerId, learner);

  return { success: true, updatedLearner: learner };
}

// --- Update Learner Profile ---

/**
 * Allows a parent to update the learner's profile including Grade and contact info.
 *
 * - The parent must be linked to the learner
 * - Grade must be 1-12
 * - Contact value is validated based on contact type
 *
 * Requirements: 8.6 (parent can update learner's profile including Grade and registered contact)
 */
export function updateLearnerProfile(
  parentId: string,
  learnerId: string,
  update: LearnerProfileUpdate
): ProfileUpdateResult {
  const parent = parentalAccountStore.get(parentId);
  if (!parent) {
    return { success: false, error: 'Parent account not found.' };
  }

  if (!parent.linkedLearnerIds.includes(learnerId)) {
    return { success: false, error: 'Parent is not linked to this learner.' };
  }

  const learner = learnerStoreById.get(learnerId);
  if (!learner) {
    return { success: false, error: 'Learner not found.' };
  }

  // Validate grade if provided
  if (update.grade !== undefined) {
    if (!Number.isInteger(update.grade) || update.grade < 1 || update.grade > 12) {
      return { success: false, error: 'Grade must be between 1 and 12.' };
    }
  }

  // Validate contact info if provided
  if (update.contactValue !== undefined) {
    const contactType = update.contactType ?? learner.contactType;
    if (contactType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(update.contactValue)) {
        return { success: false, error: 'Invalid email format.' };
      }
    } else if (contactType === 'phone') {
      const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
      if (!phoneRegex.test(update.contactValue)) {
        return { success: false, error: 'Invalid phone number format.' };
      }
    }
  }

  // Apply updates
  if (update.grade !== undefined) {
    learner.grade = update.grade;
  }
  if (update.contactType !== undefined) {
    learner.contactType = update.contactType;
  }
  if (update.contactValue !== undefined) {
    learner.contactValue = update.contactValue;
  }
  if (update.displayName !== undefined) {
    learner.displayName = update.displayName;
  }

  learner.updatedAt = new Date();
  learnerStoreById.set(learnerId, learner);

  return { success: true, updatedLearner: learner };
}
