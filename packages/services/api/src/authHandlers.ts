/**
 * Authentication API Handlers.
 *
 * Handles login, registration (parent + student), forgot-password, and token validation.
 * Integrates with @learnverse/service-auth for JWT issuance, lockout logic, and session management.
 *
 * Requirements: 1.1, 2.2, 2.3, 2.5, 3.4, 3.10, 3.11
 */

import {
  login,
  validateSession,
  isAccountLocked,
  validateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
  validateRegistrationInput,
} from '@learnverse/service-auth';

import type { ApiRequest, ApiResponse } from './endpoints';

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

  const result = login({ contactValue: username, password });

  if (!result.success) {
    // After login failure, check if account became locked
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
        message: result.error,
        retryable: false,
      },
    };
  }

  const { session } = result;

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      accessToken: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.getTime(),
      tokenType: 'Bearer',
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

  // Registration logic will be fully implemented in task 2.2.
  // For now, return success to wire the endpoint structure.
  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: 'Parent account created successfully. Please register your student.',
      username: body.username,
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
    password?: string;
    grade?: number;
    parentUsername?: string;
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

  // Validate password
  if (!body.password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else {
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.valid) {
      errors.push({ field: 'password', message: passwordResult.error! });
    }
  }

  // Validate grade (1-12)
  if (body.grade === undefined || body.grade === null) {
    errors.push({ field: 'grade', message: 'Grade is required.' });
  } else if (!Number.isInteger(body.grade) || body.grade < 1 || body.grade > 12) {
    errors.push({ field: 'grade', message: 'Grade must be an integer between 1 and 12.' });
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

  // Full registration + parent-linking logic will be implemented in task 2.2.
  // For now, return success with a placeholder token (auto-login on student registration).
  return {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: {
      message: 'Student account created successfully.',
      username: body.username,
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      tokenType: 'Bearer',
    },
  };
}

// --- POST /api/v1/auth/forgot-password ---

/**
 * Initiates the password recovery process.
 * Sends a reset link/code to the registered parent's phone or email.
 *
 * Body: { username: string }
 *
 * Always returns 200 to avoid user enumeration, regardless of whether the account exists.
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

  // Always return 200 to prevent username enumeration attacks.
  // Actual password reset delivery will be implemented when notification service is available.
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

  const session = validateSession(token);

  if (!session) {
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
      learnerId: session.learnerId,
      expiresAt: session.expiresAt.getTime(),
    },
  };
}
