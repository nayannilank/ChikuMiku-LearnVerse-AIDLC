/**
 * Authentication API Handlers.
 *
 * Handles login, registration (parent + student), forgot-password, reset-password,
 * token refresh, and token validation.
 * Integrates with @learnverse/service-auth for JWT issuance, lockout logic, and session management.
 *
 * Requirements: 1.1, 2.2, 2.3, 2.5, 3.1-3.5, 4.1-4.5, 5.1-5.4
 */

import {
  isAccountLocked,
  recordFailedAttempt,
  resetFailureCounter,
  validateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
  registerParent,
  registerStudent,
  addLearnerToStore,
  getLearnersByParentId,
  getLearnerFromStoreById,
  createTokenPair,
  getJwtConfig,
  verifyToken,
  findParentByUsername,
  findStudentByUsername,
  updateParentPasswordHash,
  updateStudentPasswordHash,
  hashPassword,
  verifyPassword,
  generateResetToken,
  validateResetToken,
  consumeResetToken,
  notificationService,
} from '@learnverse/service-auth';

import type { Learner, ContactType, Grade } from '@learnverse/service-core';
import { randomUUID } from 'crypto';
import type { ApiRequest, ApiResponse } from './endpoints';

// --- Revoked Refresh Token Registry ---
// Maintains a set of revoked refresh tokens to prevent reuse (Requirement 5.3)
const revokedRefreshTokens = new Set<string>();

/**
 * Revokes a refresh token so it cannot be reused.
 */
export function revokeRefreshToken(token: string): void {
  revokedRefreshTokens.add(token);
}

/**
 * Checks if a refresh token has been revoked.
 */
export function isRefreshTokenRevoked(token: string): boolean {
  return revokedRefreshTokens.has(token);
}

/**
 * Clears the revoked token set. Used for test isolation.
 */
export function clearRevokedTokens(): void {
  revokedRefreshTokens.clear();
}

// --- POST /api/v1/auth/login ---

/**
 * Authenticates a user with username/contact and password.
 * Checks lockout state before attempting login.
 *
 * Body: { username: string, password: string }
 *
 * Returns session token on success, error on failure.
 * Returns 429 if account is locked.
 */
export async function handleLogin(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as { username?: string; password?: string } | undefined;

  if (!body?.username || !body?.password) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_FIELDS',
        message: 'Username and password are required.',
        retryable: false,
      },
    };
  }

  const { username, password } = body;

  // Check lockout before attempting login
  if (isAccountLocked(username)) {
    return {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'ACCOUNT_LOCKED',
        message:
          'Account is temporarily locked due to multiple failed login attempts. Please try again after 15 minutes.',
        retryable: true,
        suggestedAction: 'Wait 15 minutes before retrying.',
      },
    };
  }

  // Look up account by username only (parent or student store)
  const parentAccount = findParentByUsername(username);
  const studentAccount = !parentAccount ? findStudentByUsername(username) : undefined;
  const account = parentAccount || studentAccount;

  if (!account) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_USERNAME',
        message: 'Invalid User Name',
        retryable: false,
      },
    };
  }

  // Verify password against the account's stored hash
  if (!verifyPassword(password, account.passwordHash)) {
    // Record failed attempt (may trigger lockout)
    recordFailedAttempt(username, 'email');

    // Check if account became locked after this attempt
    if (isAccountLocked(username)) {
      return {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: 'ACCOUNT_LOCKED',
          message:
            'Account is temporarily locked due to multiple failed login attempts. Please try again after 15 minutes.',
          retryable: true,
          suggestedAction: 'Wait 15 minutes before retrying.',
        },
      };
    }

    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials. Please check your username and password.',
        retryable: false,
      },
    };
  }

  // Successful login — reset failure counter and issue JWT tokens
  resetFailureCounter(username);

  const jwtConfig = getJwtConfig();
  const roles = parentAccount ? ['parent'] : ['student'];
  const tokenPair = createTokenPair(account.id, roles, jwtConfig);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresAt: tokenPair.expiresAt,
      tokenType: 'Bearer',
      username: account.username,
      role: parentAccount ? 'parent' : 'student',
      userId: account.id,
    },
  };
}

// --- POST /api/v1/auth/register/parent ---

/**
 * Registers a new parent account.
 * Validates name, username, phone, and email fields.
 *
 * Body: { name: string, username: string, phone: string, email: string, password: string }
 *
 * Returns 201 on success with confirmation message.
 * Returns 400 with field-specific errors on validation failure.
 */
export async function handleRegisterParent(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as {
    name?: string;
    username?: string;
    phone?: string;
    email?: string;
    password?: string;
  } | undefined;

  if (!body) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_BODY',
        message: 'Request body is required.',
        retryable: false,
      },
    };
  }

  const errors: Array<{ field: string; message: string }> = [];

  // Validate name
  if (!body.name || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required.' });
  } else if (body.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters.' });
  }

  // Validate username
  if (!body.username) {
    errors.push({ field: 'username', message: 'Username is required.' });
  } else {
    const usernameResult = validateUsername(body.username);
    if (!usernameResult.valid) {
      errors.push({ field: 'username', message: usernameResult.error! });
    }
  }

  // Validate phone
  if (!body.phone) {
    errors.push({ field: 'phone', message: 'Phone number is required.' });
  } else {
    const phoneResult = validatePhone(body.phone);
    if (!phoneResult.valid) {
      errors.push({ field: 'phone', message: phoneResult.error! });
    }
  }

  // Validate email
  if (!body.email) {
    errors.push({ field: 'email', message: 'Email is required.' });
  } else {
    const emailResult = validateEmail(body.email);
    if (!emailResult.valid) {
      errors.push({ field: 'email', message: emailResult.error! });
    }
  }

  // Validate password
  if (!body.password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else {
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.valid) {
      errors.push({ field: 'password', message: passwordResult.error! });
    }
  }

  if (errors.length > 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        errors,
        retryable: false,
      },
    };
  }

  // Call registerParent() from service-auth
  const result = registerParent({
    name: body.name!,
    username: body.username!,
    password: body.password!,
    phoneNumber: body.phone!,
    email: body.email!,
  });

  if (!result.success) {
    // Only username uniqueness is enforced — email and phone can be shared
    // between multiple parent accounts per product requirements
    const conflictMessages = [
      'Username is already taken',
    ];
    const isConflict = result.errors.some((e) =>
      conflictMessages.includes(e.message)
    );

    if (isConflict) {
      return {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: 'CONFLICT',
          message: 'An account with this username already exists.',
          errors: result.errors.filter((e) => conflictMessages.includes(e.message)),
          retryable: false,
        },
      };
    }

    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        errors: result.errors,
        retryable: false,
      },
    };
  }

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: 'Parent account created successfully. Please register your student.',
      username: result.account.username,
    },
  };
}

// --- POST /api/v1/auth/register/student ---

/**
 * Registers a new student account linked to a parent.
 * Validates name, username, password, grade, and parent username.
 *
 * Body: { name: string, username: string, password: string, grade: number, parentUsername: string }
 *
 * Returns 201 on success with session token (auto-login).
 * Returns 400 with field-specific errors on validation failure.
 */
export async function handleRegisterStudent(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as {
    name?: string;
    username?: string;
    studentUsername?: string;
    password?: string;
    grade?: number | string;
    parentUsername?: string;
    subjects?: string[];
    customSubjects?: Array<{ name: string }>;
  } | undefined;

  if (!body) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_BODY',
        message: 'Request body is required.',
        retryable: false,
      },
    };
  }

  // Accept both "username" and "studentUsername" for compatibility with frontend
  if (!body.username && body.studentUsername) {
    body.username = body.studentUsername;
  }

  // Accept grade as string name (e.g., "Third") or number — convert to number
  if (typeof body.grade === 'string') {
    const GRADE_MAP: Record<string, number> = {
      'LKG': 0, 'UKG': 0,
      'First': 1, 'Second': 2, 'Third': 3, 'Fourth': 4,
      'Fifth': 5, 'Sixth': 6, 'Seventh': 7, 'Eighth': 8,
      'Ninth': 9, 'Tenth': 10, 'Eleventh': 11, 'Twelfth': 12,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
      '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    };
    const mapped = GRADE_MAP[body.grade];
    (body as { grade?: number | string }).grade = mapped !== undefined ? mapped : body.grade;
  }

  const errors: Array<{ field: string; message: string }> = [];

  // Validate name
  if (!body.name || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required.' });
  } else if (body.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters.' });
  }

  // Validate username
  if (!body.username) {
    errors.push({ field: 'username', message: 'Username is required.' });
  } else {
    const usernameResult = validateUsername(body.username);
    if (!usernameResult.valid) {
      errors.push({ field: 'username', message: usernameResult.error! });
    }
  }

  // Validate password
  if (!body.password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else {
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.valid) {
      errors.push({ field: 'password', message: passwordResult.error! });
    }
  }

  // Validate grade (0-12, where 0 = LKG/UKG)
  if (body.grade === undefined || body.grade === null) {
    errors.push({ field: 'grade', message: 'Grade is required.' });
  } else {
    const gradeNum = Number(body.grade);
    if (!Number.isInteger(gradeNum) || gradeNum < 0 || gradeNum > 12) {
      errors.push({ field: 'grade', message: 'Grade must be valid (LKG through Twelfth).' });
    }
  }

  // Validate parent username
  if (!body.parentUsername) {
    errors.push({ field: 'parentUsername', message: 'Parent username is required.' });
  } else {
    const parentUsernameResult = validateUsername(body.parentUsername);
    if (!parentUsernameResult.valid) {
      errors.push({ field: 'parentUsername', message: parentUsernameResult.error! });
    }
  }

  if (errors.length > 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        errors,
        retryable: false,
      },
    };
  }

  // Call registerStudent() from service-auth
  const result = registerStudent({
    name: body.name!,
    username: body.username!,
    password: body.password!,
    grade: Number(body.grade!),
    parentUsername: body.parentUsername!,
  });

  if (!result.success) {
    // Determine if this is a duplicate/conflict error or a validation error
    const isConflict = result.errors.some(
      (e) => e.message === 'Username is already taken'
    );
    const isParentNotFound = result.errors.some(
      (e) => e.field === 'parentUsername' && e.message === 'Parent username does not exist'
    );

    if (isConflict) {
      return {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: 'CONFLICT',
          message: 'An account with this username already exists.',
          errors: result.errors,
          retryable: false,
        },
      };
    }

    if (isParentNotFound) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: 'PARENT_NOT_FOUND',
          message: 'Parent account not found. Please register the parent first, then add learners.',
          errors: result.errors,
          retryable: false,
        },
      };
    }

    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        errors: result.errors,
        retryable: false,
      },
    };
  }

  // Add a Learner record to the learner store with contactValue = student username
  // Collect subjects from the registration payload
  const subjectNames: string[] = [];
  if (body.subjects && Array.isArray(body.subjects)) {
    subjectNames.push(...body.subjects.filter((s): s is string => typeof s === 'string'));
  }
  if (body.customSubjects && Array.isArray(body.customSubjects)) {
    for (const cs of body.customSubjects) {
      if (cs && typeof cs.name === 'string' && cs.name.trim().length > 0) {
        subjectNames.push(cs.name.trim());
      }
    }
  }

  const learner: Learner = {
    id: randomUUID(),
    displayName: result.account.name,
    contactType: 'email' as ContactType,
    contactValue: result.account.username,
    passwordHash: result.account.passwordHash,
    grade: result.account.grade as Grade,
    enrolledSubjects: subjectNames,
    parentAccountId: result.account.parentAccountId,
    createdAt: result.account.createdAt,
    updatedAt: result.account.updatedAt,
  };
  addLearnerToStore(learner);

  // Generate JWT token pair for auto-login
  const jwtConfig = getJwtConfig();
  const tokenPair = createTokenPair(learner.id, ['student'], jwtConfig);

  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: 'Student account created successfully.',
      username: result.account.username,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresAt: tokenPair.expiresAt,
      tokenType: 'Bearer',
    },
  };
}

// --- POST /api/v1/auth/forgot-password ---

/**
 * Initiates the password recovery process.
 * Looks up the username in both parent and student stores.
 * If found, generates a reset token and sends notification to the parent's contact.
 * For students: resolves the linked parent account and sends to parent's contact.
 *
 * Always returns 200 to avoid user enumeration, regardless of whether the account exists.
 *
 * Body: { username: string }
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export async function handleForgotPassword(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as { username?: string } | undefined;

  if (!body?.username) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'MISSING_FIELD',
        message: 'Username is required.',
        field: 'username',
        retryable: false,
      },
    };
  }

  const { username } = body;

  // Look up user in parent and student stores
  const parentAccount = findParentByUsername(username);
  const studentAccount = !parentAccount ? findStudentByUsername(username) : undefined;

  if (parentAccount) {
    // Generate reset token for parent
    const token = generateResetToken(username, 'parent');
    const resetLink = `https://learnverse.app/reset-password?token=${token}`;

    // Send notification to parent's contact
    try {
      if (parentAccount.email) {
        await notificationService.sendEmail(
          parentAccount.email,
          'Password Reset Request',
          `Your password reset link: ${resetLink}. This link expires in 1 hour.`
        );
      } else if (parentAccount.phoneNumber) {
        await notificationService.sendSms(
          parentAccount.phoneNumber,
          `Your password reset link: ${resetLink}. Expires in 1 hour.`
        );
      }
    } catch (error) {
      // Log notification failure without surfacing to client (Requirement 3.5)
      console.error('[ForgotPassword] Notification delivery failed:', error);
    }
  } else if (studentAccount) {
    // Generate reset token for student
    const token = generateResetToken(username, 'student');
    const resetLink = `https://learnverse.app/reset-password?token=${token}`;

    // Resolve linked parent account and send notification to parent's contact (Requirement 3.3)
    const linkedParent = findParentByUsername(studentAccount.parentUsername);

    if (linkedParent) {
      try {
        if (linkedParent.email) {
          await notificationService.sendEmail(
            linkedParent.email,
            'Student Password Reset Request',
            `A password reset was requested for student account "${username}". Reset link: ${resetLink}. This link expires in 1 hour.`
          );
        } else if (linkedParent.phoneNumber) {
          await notificationService.sendSms(
            linkedParent.phoneNumber,
            `Password reset for student "${username}": ${resetLink}. Expires in 1 hour.`
          );
        }
      } catch (error) {
        // Log notification failure without surfacing to client (Requirement 3.5)
        console.error('[ForgotPassword] Notification delivery failed for student:', error);
      }
    }
  }

  // Always return 200 regardless of account existence (Requirement 3.4)
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message:
        'If an account exists with this username, a password reset link has been sent to the registered contact.',
    },
  };
}

// --- GET /api/v1/auth/validate ---

/**
 * Validates the current session token.
 * Requires a valid Bearer token in the Authorization header.
 *
 * Returns 200 with session info if valid, 401 if invalid/expired.
 */
export async function handleValidateSession(req: ApiRequest): Promise<ApiResponse> {
  const authHeader =
    req.headers['authorization'] ?? req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header.',
        retryable: false,
      },
    };
  }

  const token = authHeader.slice(7);

  if (!token) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Empty token.',
        retryable: false,
      },
    };
  }

  // Use JWT verification instead of legacy session store
  const jwtConfig = getJwtConfig();
  const decoded = verifyToken(token, jwtConfig);

  if (!decoded) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'SESSION_EXPIRED',
        message: 'Session is invalid or has expired. Please log in again.',
        retryable: false,
      },
    };
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      valid: true,
      learnerId: decoded.sub,
      expiresAt: decoded.exp,
    },
  };
}

// --- POST /api/v1/auth/reset-password ---

/**
 * Resets a user's password using a valid reset token.
 * Validates the new password against registration rules.
 * Updates the account's password hash and consumes the token.
 *
 * Body: { token: string, newPassword: string }
 *
 * Returns 200 on success.
 * Returns 400 for invalid/expired token or invalid password.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export async function handleResetPassword(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as { token?: string; newPassword?: string } | undefined;

  if (!body?.token || !body?.newPassword) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Token and new password are required.',
        retryable: false,
      },
    };
  }

  const { token, newPassword } = body;

  // Validate the new password against registration rules (Requirement 4.5)
  const passwordResult = validatePassword(newPassword);
  if (!passwordResult.valid) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: passwordResult.error!,
        field: 'newPassword',
        retryable: false,
      },
    };
  }

  // Validate the reset token (Requirement 4.2, 4.3)
  const tokenEntry = validateResetToken(token);
  if (!tokenEntry) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_RESET_TOKEN',
        message: 'The reset token is invalid or has expired.',
        retryable: false,
      },
    };
  }

  // Update the account's password hash (Requirement 4.1)
  const newPasswordHash = hashPassword(newPassword);
  let updated = false;

  if (tokenEntry.accountType === 'parent') {
    updated = updateParentPasswordHash(tokenEntry.username, newPasswordHash);
  } else {
    updated = updateStudentPasswordHash(tokenEntry.username, newPasswordHash);
  }

  if (!updated) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_RESET_TOKEN',
        message: 'Unable to reset password. Account not found.',
        retryable: false,
      },
    };
  }

  // Consume the token to prevent reuse (Requirement 4.4)
  consumeResetToken(token);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: 'Password has been reset successfully. You can now log in with your new password.',
    },
  };
}

// --- POST /api/v1/auth/refresh ---

/**
 * Refreshes an expired access token using a valid refresh token.
 * Verifies the refresh token is valid, not expired, and not revoked.
 * Revokes the old refresh token and issues a new token pair.
 *
 * Body: { refreshToken: string }
 *
 * Returns 200 with new token pair on success.
 * Returns 401 for invalid/expired/revoked refresh tokens.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export async function handleRefresh(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body as { refreshToken?: string } | undefined;

  if (!body?.refreshToken) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_TOKEN',
        message: 'Refresh token is required.',
        retryable: false,
      },
    };
  }

  const { refreshToken } = body;

  // Check if the refresh token has been revoked (Requirement 5.3)
  if (isRefreshTokenRevoked(refreshToken)) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_TOKEN',
        message: 'Refresh token has been revoked. Please log in again.',
        retryable: false,
      },
    };
  }

  // Verify the refresh token via JWT verification (Requirement 5.2)
  const jwtConfig = getJwtConfig();
  const decoded = verifyToken(refreshToken, jwtConfig);

  if (!decoded) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired refresh token. Please log in again.',
        retryable: false,
      },
    };
  }

  // Verify it's actually a refresh token type
  if (decoded.type !== 'refresh') {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token type. Expected a refresh token.',
        retryable: false,
      },
    };
  }

  // Revoke the old refresh token to prevent reuse (Requirement 5.3)
  revokeRefreshToken(refreshToken);

  // Issue a new token pair with minimum 30-day access token expiry (Requirement 5.1, 5.4)
  const newTokenPair = createTokenPair(decoded.sub, decoded.roles, jwtConfig);

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
      expiresAt: newTokenPair.expiresAt,
      tokenType: 'Bearer',
    },
  };
}

// --- GET /api/v1/parent/learners ---

/**
 * Returns all learners linked to the authenticated parent.
 * Extracts the parent ID from the JWT token (sub field).
 * Returns an array of learner objects with id, name, grade, and subjects.
 *
 * Requires a valid Bearer token with 'parent' role.
 */
export async function handleGetLearners(req: ApiRequest): Promise<ApiResponse> {
  const authHeader =
    req.headers['authorization'] ?? req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
        retryable: false,
      },
    };
  }

  const token = authHeader.slice(7);
  const jwtConfig = getJwtConfig();
  const decoded = verifyToken(token, jwtConfig);

  if (!decoded) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
        retryable: false,
      },
    };
  }

  // The parent ID is the 'sub' claim in the JWT
  const parentId = decoded.sub;

  // Fetch all learners linked to this parent
  const learners = getLearnersByParentId(parentId);

  // Map grade number to a readable string
  const GRADE_NAMES: Record<number, string> = {
    0: 'LKG/UKG',
    1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth',
    5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth',
    9: 'Ninth', 10: 'Tenth', 11: 'Eleventh', 12: 'Twelfth',
  };

  const result = learners.map((learner) => ({
    id: learner.id,
    name: learner.displayName,
    grade: GRADE_NAMES[learner.grade as number] ?? `Grade ${learner.grade}`,
    subjects: learner.enrolledSubjects ?? [],
  }));

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: result,
  };
}

// --- GET /api/v1/learner/subjects ---

/** Subject color mapping for the design system. */
const SUBJECT_COLORS: Record<string, string> = {
  Maths: '#E94F9B',
  Science: '#4ECDC4',
  Computers: '#4A6CF7',
  EVS: '#27AE60',
  Hindi: '#F7C948',
  English: '#5DADE2',
  Kannada: '#9B59B6',
};

/**
 * Returns the enrolled subjects for the authenticated learner.
 * Extracts learner ID from the JWT token's `sub` claim and
 * looks up the learner's enrolledSubjects array.
 *
 * Returns an array of { name, color } objects.
 * Requires a valid Bearer token with 'student' role.
 */
export async function handleGetLearnerSubjects(req: ApiRequest): Promise<ApiResponse> {
  const authHeader =
    req.headers['authorization'] ?? req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
        retryable: false,
      },
    };
  }

  const token = authHeader.slice(7);
  const jwtConfig = getJwtConfig();
  const decoded = verifyToken(token, jwtConfig);

  if (!decoded) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
        retryable: false,
      },
    };
  }

  // The learner ID is the 'sub' claim in the JWT
  const learnerId = decoded.sub;

  // Look up the learner in the session store
  const learner = getLearnerFromStoreById(learnerId);

  if (!learner) {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: [],
    };
  }

  // Default color for subjects not in the design system
  const DEFAULT_COLOR = '#6B7280';

  const subjects = (learner.enrolledSubjects ?? []).map((name) => ({
    name,
    color: SUBJECT_COLORS[name] ?? DEFAULT_COLOR,
  }));

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: subjects,
  };
}
