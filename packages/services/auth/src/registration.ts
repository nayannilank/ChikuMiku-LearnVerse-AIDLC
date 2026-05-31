/**
 * Registration service with input validation.
 *
 * Validates registration input fields and returns field-specific errors
 * while preserving valid form data on validation failure.
 *
 * Requirements: 8.1, 8.8
 */

import { Grade, ContactType } from '@chikumiku/service-core';
import { validateGrade, ValidationResult } from '@chikumiku/service-core';

// --- Registration Types ---

export interface RegistrationInput {
  contactType: ContactType;
  contactValue: string;
  password: string;
  grade: unknown;
  displayName: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface RegistrationValidationSuccess {
  success: true;
  value: {
    contactType: ContactType;
    contactValue: string;
    password: string;
    grade: Grade;
    displayName: string;
  };
}

export interface RegistrationValidationFailure {
  success: false;
  errors: FieldError[];
  /** Preserved valid form data so the user doesn't need to re-enter it */
  preservedData: Partial<RegistrationInput>;
}

export type RegistrationValidationResult =
  | RegistrationValidationSuccess
  | RegistrationValidationFailure;

// --- Password Validation ---

/** Minimum password length */
export const MIN_PASSWORD_LENGTH = 8;
/** Maximum password length */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Validates a password meets the requirements:
 * - Between 8 and 128 characters
 * - Contains at least one letter (a-z or A-Z)
 * - Contains at least one digit (0-9)
 */
export function validatePassword(password: string): ValidationResult<string> {
  if (typeof password !== 'string') {
    return { success: false, error: 'Password must be a string' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      success: false,
      error: 'Password must contain at least one letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      success: false,
      error: 'Password must contain at least one digit',
    };
  }

  return { success: true, value: password };
}

// --- Email Validation ---

/**
 * Validates an email address format.
 * Uses a basic RFC-compliant check: local@domain with at least one dot in domain.
 */
export function validateEmail(email: string): ValidationResult<string> {
  if (typeof email !== 'string') {
    return { success: false, error: 'Email must be a string' };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { success: false, error: 'Email must not be empty' };
  }

  // Basic RFC-compliant email regex:
  // - Local part: one or more characters that are not @ or whitespace
  // - @ symbol
  // - Domain: one or more labels separated by dots, each label is alphanumeric/hyphen
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      success: false,
      error: 'Email format is invalid. Expected format: user@example.com',
    };
  }

  return { success: true, value: trimmed };
}

// --- Phone Number Validation ---

/**
 * Validates a phone number format.
 * Accepts formats like: +1234567890, +91-9876543210, (123) 456-7890, 123-456-7890
 * Must contain at least 7 digits and at most 15 digits (E.164 max).
 */
export function validatePhoneNumber(phone: string): ValidationResult<string> {
  if (typeof phone !== 'string') {
    return { success: false, error: 'Phone number must be a string' };
  }

  const trimmed = phone.trim();

  if (trimmed.length === 0) {
    return { success: false, error: 'Phone number must not be empty' };
  }

  // Allow digits, plus sign, hyphens, spaces, parentheses, and dots
  const phoneRegex = /^[+]?[\d\s\-().]+$/;

  if (!phoneRegex.test(trimmed)) {
    return {
      success: false,
      error: 'Phone number contains invalid characters. Use digits, +, -, spaces, or parentheses',
    };
  }

  // Extract only digits to count them
  const digits = trimmed.replace(/[^0-9]/g, '');

  if (digits.length < 7) {
    return {
      success: false,
      error: 'Phone number must contain at least 7 digits',
    };
  }

  if (digits.length > 15) {
    return {
      success: false,
      error: 'Phone number must not exceed 15 digits',
    };
  }

  return { success: true, value: trimmed };
}

// --- Display Name Validation ---

/**
 * Validates a display name is non-empty.
 */
export function validateDisplayName(name: string): ValidationResult<string> {
  if (typeof name !== 'string') {
    return { success: false, error: 'Display name must be a string' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { success: false, error: 'Display name must not be empty' };
  }

  return { success: true, value: trimmed };
}

// --- Registration Validation ---

/**
 * Validates all registration input fields.
 *
 * Returns field-specific errors on validation failure while preserving
 * valid form data so the user can correct only the invalid fields.
 */
export function validateRegistrationInput(
  input: RegistrationInput
): RegistrationValidationResult {
  const errors: FieldError[] = [];

  // Validate contact value based on contact type
  if (input.contactType === 'email') {
    const emailResult = validateEmail(input.contactValue);
    if (!emailResult.success) {
      errors.push({ field: 'contactValue', message: emailResult.error });
    }
  } else if (input.contactType === 'phone') {
    const phoneResult = validatePhoneNumber(input.contactValue);
    if (!phoneResult.success) {
      errors.push({ field: 'contactValue', message: phoneResult.error });
    }
  } else {
    errors.push({
      field: 'contactType',
      message: 'Contact type must be either "email" or "phone"',
    });
  }

  // Validate password
  const passwordResult = validatePassword(input.password);
  if (!passwordResult.success) {
    errors.push({ field: 'password', message: passwordResult.error });
  }

  // Validate grade
  const gradeResult = validateGrade(input.grade);
  if (!gradeResult.success) {
    errors.push({ field: 'grade', message: gradeResult.error });
  }

  // Validate display name
  const displayNameResult = validateDisplayName(input.displayName);
  if (!displayNameResult.success) {
    errors.push({ field: 'displayName', message: displayNameResult.error });
  }

  if (errors.length > 0) {
    // Preserve all valid form data so user doesn't need to re-enter it
    const preservedData: Partial<RegistrationInput> = {};

    if (input.contactType === 'email' || input.contactType === 'phone') {
      preservedData.contactType = input.contactType;
    }
    if (!errors.some((e) => e.field === 'contactValue')) {
      preservedData.contactValue = input.contactValue;
    }
    if (!errors.some((e) => e.field === 'displayName')) {
      preservedData.displayName = input.displayName;
    }
    if (!errors.some((e) => e.field === 'grade')) {
      preservedData.grade = input.grade;
    }
    // Never preserve password in preserved data for security
    // (but the form can keep it client-side)

    return { success: false, errors, preservedData };
  }

  // At this point all validations passed, so we can safely access .value
  const validatedGrade = gradeResult as { success: true; value: Grade };
  const validatedDisplayName = validateDisplayName(input.displayName) as { success: true; value: string };

  return {
    success: true,
    value: {
      contactType: input.contactType,
      contactValue: input.contactValue,
      password: input.password,
      grade: validatedGrade.value,
      displayName: validatedDisplayName.value,
    },
  };
}
