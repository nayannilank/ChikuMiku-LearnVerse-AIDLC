/**
 * @learnverse/service-auth
 *
 * Authentication service: registration, login, session management, parental account linking.
 */

export * from './validation';
export {
  type RegistrationInput,
  type FieldError,
  type RegistrationValidationSuccess,
  type RegistrationValidationFailure,
  type RegistrationValidationResult,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  validatePassword as validateRegistrationPassword,
  validateEmail as validateRegistrationEmail,
  validatePhoneNumber,
  validateDisplayName,
  validateRegistrationInput,
  type ParentAccount,
  type StudentAccount,
  type ParentRegistrationInput,
  type StudentRegistrationInput,
  type ParentStudentFieldError,
  type ParentRegistrationSuccess,
  type ParentRegistrationFailure,
  type ParentRegistrationResult,
  type StudentRegistrationSuccess,
  type StudentRegistrationFailure,
  type StudentRegistrationResult,
  registerParent,
  registerStudent,
  clearParentStudentStore,
  findParentByUsername,
} from './registration';
export * from './session';
export * from './lockout';
export * from './localBackup';
export * from './parental';
