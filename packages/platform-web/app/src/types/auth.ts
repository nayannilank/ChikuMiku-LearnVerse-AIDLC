/**
 * Shared authentication type definitions for the LearnVerse web application.
 *
 * These types define the contracts for login, registration, and password reset
 * flows across the Auth_Service and UI components.
 */

/** The two account roles supported by the platform. */
export type UserRole = 'parent' | 'student';

/**
 * A generic result wrapper returned by all Auth_Service operations.
 * Callers check `success` to determine outcome without catching exceptions.
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Payload sent to POST /api/v1/auth/login. */
export interface LoginRequest {
  username: string;
  password: string;
  role: UserRole;
}

/** Data returned on successful login. */
export interface LoginSuccessData {
  token: string;
  username: string;
}

/** Payload sent to POST /api/v1/auth/register/parent. */
export interface ParentRegistrationRequest {
  username: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}

/** Payload sent to POST /api/v1/auth/register/student. */
export interface StudentRegistrationRequest {
  parentUsername: string;
  studentUsername: string;
  name: string;
  password: string;
  gender: 'male' | 'female' | 'other';
  grade: string;
  schoolName: string;
  subjects: string[];
  customSubjects?: { name: string }[];
}

/** Payload sent to POST /api/v1/auth/forgot-password. */
export interface ForgotPasswordRequest {
  identifier: string; // parent username or email
}

/** Payload sent to POST /api/v1/auth/reset-password. */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
