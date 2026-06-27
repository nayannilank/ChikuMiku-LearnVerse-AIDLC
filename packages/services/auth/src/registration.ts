/**
 * Registration service with input validation.
 *
 * Validates registration input fields and returns field-specific errors
 * while preserving valid form data on validation failure.
 *
 * Requirements: 8.1, 8.8, 3.1, 3.6, 3.7, 3.10, 3.12, 3.14
 */

import { Grade, ContactType } from '@learnverse/service-core';
import { validateGrade, ValidationResult } from '@learnverse/service-core';
import { randomUUID } from 'crypto';
import { validateUsername, validatePassword as validatePasswordStrict, validateEmail as validateEmailStrict, validatePhone } from './validation';
import { hashPassword } from './session';

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


// --- Parent-Student Registration Types ---

/** Maximum name length */
const MAX_NAME_LENGTH = 100;

/**
 * Represents a registered parent account.
 * Requirements: 3.1
 */
export interface ParentAccount {
  id: string;
  name: string;
  username: string;
  phoneNumber: string;
  email: string;
  passwordHash: string;
  linkedStudentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a registered student account linked to a parent.
 * Requirements: 3.7
 */
export interface StudentAccount {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  grade: number;
  parentUsername: string;
  parentAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input fields for parent registration.
 */
export interface ParentRegistrationInput {
  name: string;
  username: string;
  password: string;
  phoneNumber: string;
  email: string;
}

/**
 * Input fields for student registration.
 */
export interface StudentRegistrationInput {
  name: string;
  username: string;
  password: string;
  grade: number;
  parentUsername: string;
}

/**
 * Field-level error for parent/student registration.
 */
export interface ParentStudentFieldError {
  field: string;
  message: string;
}

/**
 * Successful parent registration result.
 */
export interface ParentRegistrationSuccess {
  success: true;
  account: ParentAccount;
}

/**
 * Failed parent registration result with field errors and preserved data.
 */
export interface ParentRegistrationFailure {
  success: false;
  errors: ParentStudentFieldError[];
  preservedData: Partial<ParentRegistrationInput>;
}

export type ParentRegistrationResult = ParentRegistrationSuccess | ParentRegistrationFailure;

/**
 * Successful student registration result.
 */
export interface StudentRegistrationSuccess {
  success: true;
  account: StudentAccount;
}

/**
 * Failed student registration result with field errors and preserved data.
 */
export interface StudentRegistrationFailure {
  success: false;
  errors: ParentStudentFieldError[];
  preservedData: Partial<StudentRegistrationInput>;
}

export type StudentRegistrationResult = StudentRegistrationSuccess | StudentRegistrationFailure;

// --- In-Memory Stores for Parent/Student Accounts ---

const parentAccountStore = new Map<string, ParentAccount>();
const studentAccountStore = new Map<string, StudentAccount>();

/**
 * Clears the parent and student account stores. Useful for test isolation.
 */
export function clearParentStudentStore(): void {
  parentAccountStore.clear();
  studentAccountStore.clear();
}

/**
 * Retrieves a parent account by username. Used for parent lookup during student registration.
 */
export function findParentByUsername(username: string): ParentAccount | undefined {
  for (const account of parentAccountStore.values()) {
    if (account.username === username) {
      return account;
    }
  }
  return undefined;
}

/**
 * Retrieves a student account by username. Used for forgot-password and login lookups.
 */
export function findStudentByUsername(username: string): StudentAccount | undefined {
  for (const account of studentAccountStore.values()) {
    if (account.username === username) {
      return account;
    }
  }
  return undefined;
}

/**
 * Updates the password hash for a parent account identified by username.
 * Returns true if the account was found and updated, false otherwise.
 */
export function updateParentPasswordHash(username: string, newPasswordHash: string): boolean {
  for (const account of parentAccountStore.values()) {
    if (account.username === username) {
      account.passwordHash = newPasswordHash;
      account.updatedAt = new Date();
      return true;
    }
  }
  return false;
}

/**
 * Updates the password hash for a student account identified by username.
 * Returns true if the account was found and updated, false otherwise.
 */
export function updateStudentPasswordHash(username: string, newPasswordHash: string): boolean {
  for (const account of studentAccountStore.values()) {
    if (account.username === username) {
      account.passwordHash = newPasswordHash;
      account.updatedAt = new Date();
      return true;
    }
  }
  return false;
}

/**
 * Retrieves a parent account by email.
 */
function findParentByEmail(email: string): ParentAccount | undefined {
  for (const account of parentAccountStore.values()) {
    if (account.email === email) {
      return account;
    }
  }
  return undefined;
}

/**
 * Retrieves a parent account by phone number.
 */
function findParentByPhone(phone: string): ParentAccount | undefined {
  for (const account of parentAccountStore.values()) {
    if (account.phoneNumber === phone) {
      return account;
    }
  }
  return undefined;
}

/**
 * Checks if a username is already taken by any parent or student.
 */
function isUsernameTaken(username: string): boolean {
  for (const account of parentAccountStore.values()) {
    if (account.username === username) {
      return true;
    }
  }
  for (const account of studentAccountStore.values()) {
    if (account.username === username) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a name field (max 100 chars, non-empty after trim).
 */
function validateName(name: string): { valid: boolean; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name must not be empty' };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must not exceed ${MAX_NAME_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Validates a grade value (integer between 1 and 12 inclusive).
 */
function validateGradeField(grade: number): { valid: boolean; error?: string } {
  if (typeof grade !== 'number' || !Number.isInteger(grade)) {
    return { valid: false, error: 'Grade must be an integer' };
  }
  if (grade < 1 || grade > 12) {
    return { valid: false, error: 'Grade must be between 1 and 12' };
  }
  return { valid: true };
}

// --- Parent Registration ---

/**
 * Registers a new parent account.
 *
 * Validates all fields:
 * - name: max 100 chars, non-empty
 * - username: 5-15 chars, alphanumeric + underscores + hyphens
 * - password: 8-20 chars with uppercase + lowercase + digit + special
 * - phoneNumber: exactly 10 digits
 * - email: max 254 chars with @ and domain
 *
 * Checks for duplicate username, email, and phone.
 * Returns field-specific errors and preserves valid field values on failure.
 *
 * Requirements: 3.1, 3.6, 3.14
 */
export function registerParent(input: ParentRegistrationInput): ParentRegistrationResult {
  const errors: ParentStudentFieldError[] = [];

  // Validate name
  const nameResult = validateName(input.name);
  if (!nameResult.valid) {
    errors.push({ field: 'name', message: nameResult.error! });
  }

  // Validate username
  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid) {
    errors.push({ field: 'username', message: usernameResult.error! });
  }

  // Validate password (strict: 8-20, uppercase + lowercase + digit + special)
  const passwordResult = validatePasswordStrict(input.password);
  if (!passwordResult.valid) {
    errors.push({ field: 'password', message: passwordResult.error! });
  }

  // Validate phone
  const phoneResult = validatePhone(input.phoneNumber);
  if (!phoneResult.valid) {
    errors.push({ field: 'phoneNumber', message: phoneResult.error! });
  }

  // Validate email
  const emailResult = validateEmailStrict(input.email);
  if (!emailResult.valid) {
    errors.push({ field: 'email', message: emailResult.error! });
  }

  // If there are validation errors, return early with preserved data
  if (errors.length > 0) {
    const preservedData: Partial<ParentRegistrationInput> = {};
    const errorFields = new Set(errors.map((e) => e.field));

    if (!errorFields.has('name')) preservedData.name = input.name;
    if (!errorFields.has('username')) preservedData.username = input.username;
    if (!errorFields.has('phoneNumber')) preservedData.phoneNumber = input.phoneNumber;
    if (!errorFields.has('email')) preservedData.email = input.email;
    // Never preserve password

    return { success: false, errors, preservedData };
  }

  // Check for duplicates — only username must be unique.
  // Multiple parents CAN share the same email and phone number per product requirements.
  if (isUsernameTaken(input.username)) {
    errors.push({ field: 'username', message: 'Username is already taken' });
  }

  if (errors.length > 0) {
    const preservedData: Partial<ParentRegistrationInput> = {};
    const errorFields = new Set(errors.map((e) => e.field));

    if (!errorFields.has('name')) preservedData.name = input.name;
    if (!errorFields.has('username')) preservedData.username = input.username;
    if (!errorFields.has('phoneNumber')) preservedData.phoneNumber = input.phoneNumber;
    if (!errorFields.has('email')) preservedData.email = input.email;

    return { success: false, errors, preservedData };
  }

  // Create the parent account
  const now = new Date();
  const account: ParentAccount = {
    id: randomUUID(),
    name: input.name.trim(),
    username: input.username,
    phoneNumber: input.phoneNumber,
    email: input.email,
    passwordHash: hashPassword(input.password),
    linkedStudentIds: [],
    createdAt: now,
    updatedAt: now,
  };

  parentAccountStore.set(account.id, account);
  return { success: true, account };
}

// --- Student Registration ---

/**
 * Registers a new student account linked to a parent.
 *
 * Validates all fields:
 * - name: max 100 chars, non-empty
 * - username: 5-15 chars, alphanumeric + underscores + hyphens
 * - password: 8-20 chars with uppercase + lowercase + digit + special
 * - grade: integer 1-12
 * - parentUsername: 5-15 chars, must exist as a registered parent
 *
 * Checks for duplicate username.
 * Verifies parent username exists and links student to parent.
 * Returns field-specific errors and preserves valid field values on failure.
 *
 * Requirements: 3.7, 3.10, 3.12, 3.14
 */
export function registerStudent(input: StudentRegistrationInput): StudentRegistrationResult {
  const errors: ParentStudentFieldError[] = [];

  // Validate name
  const nameResult = validateName(input.name);
  if (!nameResult.valid) {
    errors.push({ field: 'name', message: nameResult.error! });
  }

  // Validate username
  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid) {
    errors.push({ field: 'username', message: usernameResult.error! });
  }

  // Validate password (strict: 8-20, uppercase + lowercase + digit + special)
  const passwordResult = validatePasswordStrict(input.password);
  if (!passwordResult.valid) {
    errors.push({ field: 'password', message: passwordResult.error! });
  }

  // Validate grade
  const gradeResult = validateGradeField(input.grade);
  if (!gradeResult.valid) {
    errors.push({ field: 'grade', message: gradeResult.error! });
  }

  // Validate parentUsername format
  const parentUsernameResult = validateUsername(input.parentUsername);
  if (!parentUsernameResult.valid) {
    errors.push({ field: 'parentUsername', message: parentUsernameResult.error! });
  }

  // If there are validation errors, return early with preserved data
  if (errors.length > 0) {
    const preservedData: Partial<StudentRegistrationInput> = {};
    const errorFields = new Set(errors.map((e) => e.field));

    if (!errorFields.has('name')) preservedData.name = input.name;
    if (!errorFields.has('username')) preservedData.username = input.username;
    if (!errorFields.has('grade')) preservedData.grade = input.grade;
    if (!errorFields.has('parentUsername')) preservedData.parentUsername = input.parentUsername;
    // Never preserve password

    return { success: false, errors, preservedData };
  }

  // Check for duplicate username
  if (isUsernameTaken(input.username)) {
    errors.push({ field: 'username', message: 'Username is already taken' });
  }

  // Verify parent username exists
  const parentAccount = findParentByUsername(input.parentUsername);
  if (!parentAccount) {
    errors.push({ field: 'parentUsername', message: 'Parent username does not exist' });
  }

  if (errors.length > 0) {
    const preservedData: Partial<StudentRegistrationInput> = {};
    const errorFields = new Set(errors.map((e) => e.field));

    if (!errorFields.has('name')) preservedData.name = input.name;
    if (!errorFields.has('username')) preservedData.username = input.username;
    if (!errorFields.has('grade')) preservedData.grade = input.grade;
    if (!errorFields.has('parentUsername')) preservedData.parentUsername = input.parentUsername;

    return { success: false, errors, preservedData };
  }

  // Create the student account and link to parent
  const now = new Date();
  const account: StudentAccount = {
    id: randomUUID(),
    name: input.name.trim(),
    username: input.username,
    passwordHash: hashPassword(input.password),
    grade: input.grade,
    parentUsername: input.parentUsername,
    parentAccountId: parentAccount!.id,
    createdAt: now,
    updatedAt: now,
  };

  studentAccountStore.set(account.id, account);

  // Link student to parent
  parentAccount!.linkedStudentIds.push(account.id);

  return { success: true, account };
}
