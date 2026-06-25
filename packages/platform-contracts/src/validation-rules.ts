/**
 * Validation Rules — Shared constants for input validation.
 *
 * These rules are used by both client-side (inline validation) and server-side
 * (Lambda handler) validation logic. Keeping them in a shared package ensures
 * consistent behavior across the stack.
 */

// ============================================================
// Username
// ============================================================

export const USERNAME = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 15,
  /** Alphabets, numbers, hyphens, and underscores */
  PATTERN: /^[a-zA-Z0-9_-]+$/,
  PATTERN_STRING: '^[a-zA-Z0-9_-]+$',
  ERROR_MESSAGE:
    'Username must be 8-15 characters containing only letters, numbers, hyphens, or underscores',
} as const;

// ============================================================
// Name
// ============================================================

export const NAME = {
  MIN_LENGTH: 5,
  MAX_LENGTH: 20,
  /** Alphabets and spaces only */
  PATTERN: /^[a-zA-Z ]+$/,
  PATTERN_STRING: '^[a-zA-Z ]+$',
  ERROR_MESSAGE: 'Name must be 5-20 characters containing only letters and spaces',
} as const;

// ============================================================
// Phone
// ============================================================

export const PHONE = {
  EXACT_LENGTH: 10,
  /** Exactly 10 digits */
  PATTERN: /^\d{10}$/,
  PATTERN_STRING: '^\\d{10}$',
  ERROR_MESSAGE: 'Phone number must be exactly 10 digits',
} as const;

// ============================================================
// Email
// ============================================================

export const EMAIL = {
  MAX_LENGTH: 30,
  /** Standard email pattern */
  PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PATTERN_STRING: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  ERROR_MESSAGE: 'Email must be a valid email address within 30 characters',
} as const;

// ============================================================
// Password
// ============================================================

export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 20,
  /** At least one uppercase, one lowercase, one number, one special character */
  PATTERN: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,20}$/,
  PATTERN_STRING:
    '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>/?]).{8,20}$',
  ERROR_MESSAGE:
    'Password must be 8-20 characters with at least one uppercase, one lowercase, one number, and one special character',
} as const;

// ============================================================
// School Name
// ============================================================

export const SCHOOL_NAME = {
  MIN_LENGTH: 5,
  MAX_LENGTH: 30,
  /** Alphabets, numbers, commas, and hyphens */
  PATTERN: /^[a-zA-Z0-9, -]+$/,
  PATTERN_STRING: '^[a-zA-Z0-9, -]+$',
  ERROR_MESSAGE:
    'School name must be 5-30 characters containing letters, numbers, commas, or hyphens',
} as const;

// ============================================================
// Custom Subject Name
// ============================================================

export const CUSTOM_SUBJECT_NAME = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 50,
  ERROR_MESSAGE: 'Custom subject name must be 1-50 characters',
} as const;

// ============================================================
// Book Name
// ============================================================

export const BOOK_NAME = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 200,
  ERROR_MESSAGE: 'Book name must be 1-200 characters',
} as const;

// ============================================================
// Chapter Name
// ============================================================

export const CHAPTER_NAME = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 200,
  ERROR_MESSAGE: 'Chapter name must be 1-200 characters',
} as const;

// ============================================================
// File Upload Limits
// ============================================================

/** Maximum file size per uploaded image: 10 MB */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum number of pages per chapter */
export const MAX_PAGES_PER_CHAPTER = 50;

/** Accepted image MIME types for page uploads */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const;

// ============================================================
// OTP
// ============================================================

/** OTP expiration time in minutes */
export const OTP_EXPIRY_MINUTES = 10;

// ============================================================
// Quiz Timer
// ============================================================

/** Minimum quiz timer duration in seconds (30 seconds) */
export const QUIZ_TIMER_MIN_SECONDS = 30;

/** Maximum quiz timer duration in seconds (1 hour) */
export const QUIZ_TIMER_MAX_SECONDS = 3600;

// ============================================================
// Display Constraints
// ============================================================

/** Maximum characters to display for student name in greeting */
export const GREETING_NAME_MAX_LENGTH = 30;

// ============================================================
// Grades (valid values)
// ============================================================

export const VALID_GRADES = [
  'LKG',
  'UKG',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
] as const;
