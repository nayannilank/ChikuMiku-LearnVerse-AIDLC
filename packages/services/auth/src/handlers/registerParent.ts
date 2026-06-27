/**
 * Parent Registration Lambda Handler
 *
 * Validates registration input, creates a Cognito user, adds to "parent" group,
 * and inserts a record into the `parents` table.
 *
 * Only username must be unique. Multiple parents CAN share the same email
 * and phone number per product requirements.
 *
 * Requirements: 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.44, 1.45
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from '@learnverse/service-core';
import { randomUUID } from 'crypto';

// ============================================================
// Interfaces for External Dependencies (testability)
// ============================================================

export interface CognitoClient {
  createUser(params: {
    username: string;
    password: string;
    email: string;
    phone: string;
    name: string;
  }): Promise<{ cognitoSub: string }>;

  addUserToGroup(params: {
    username: string;
    groupName: string;
  }): Promise<void>;
}

export interface DbClient {
  insertParent(params: {
    id: string;
    username: string;
    name: string;
    email: string;
    phone: string;
    cognitoSub: string;
  }): Promise<void>;
}

// ============================================================
// Validation
// ============================================================

interface FieldError {
  field: string;
  message: string;
}

interface ParentRegistrationBody {
  username: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}

const USERNAME_MIN = 8;
const USERNAME_MAX = 15;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const NAME_MIN = 5;
const NAME_MAX = 20;
const NAME_PATTERN = /^[a-zA-Z\s]+$/;

const PHONE_PATTERN = /^\d{10}$/;

const EMAIL_MAX = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

function validateFields(body: ParentRegistrationBody): FieldError[] {
  const errors: FieldError[] = [];

  // Username validation
  if (!body.username || typeof body.username !== 'string') {
    errors.push({ field: 'username', message: 'Username is required' });
  } else if (body.username.length < USERNAME_MIN || body.username.length > USERNAME_MAX) {
    errors.push({ field: 'username', message: `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters` });
  } else if (!USERNAME_PATTERN.test(body.username)) {
    errors.push({ field: 'username', message: 'Username must contain only alphabets, numbers, hyphens, or underscores' });
  }

  // Name validation
  if (!body.name || typeof body.name !== 'string') {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (body.name.length < NAME_MIN || body.name.length > NAME_MAX) {
    errors.push({ field: 'name', message: `Name must be between ${NAME_MIN} and ${NAME_MAX} characters` });
  } else if (!NAME_PATTERN.test(body.name)) {
    errors.push({ field: 'name', message: 'Name must contain only alphabets and spaces' });
  }

  // Phone validation
  if (!body.phone || typeof body.phone !== 'string') {
    errors.push({ field: 'phone', message: 'Phone number is required' });
  } else if (!PHONE_PATTERN.test(body.phone)) {
    errors.push({ field: 'phone', message: 'Phone number must be exactly 10 digits' });
  }

  // Email validation
  if (!body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (body.email.length > EMAIL_MAX) {
    errors.push({ field: 'email', message: `Email must not exceed ${EMAIL_MAX} characters` });
  } else if (!EMAIL_PATTERN.test(body.email)) {
    errors.push({ field: 'email', message: 'Email must be in a valid format' });
  }

  // Password validation
  if (!body.password || typeof body.password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' });
  } else {
    if (body.password.length < PASSWORD_MIN || body.password.length > PASSWORD_MAX) {
      errors.push({ field: 'password', message: `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters` });
    } else {
      if (!/[A-Z]/.test(body.password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
      }
      if (!/[a-z]/.test(body.password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
      }
      if (!/[0-9]/.test(body.password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one number' });
      }
      if (!/[^a-zA-Z0-9\s]/.test(body.password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one special symbol' });
      }
    }
  }

  return errors;
}

// ============================================================
// CORS Headers
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Duplicate Error Detection
// ============================================================

export interface CognitoDuplicateError extends Error {
  code: string;
  duplicateField?: 'username';
}

const DUPLICATE_MESSAGES: Record<string, string> = {
  username: 'Username already taken — please choose a different username',
};

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a registerParent Lambda handler with injected dependencies.
 * This allows easy testing by providing mock Cognito and DB clients.
 */
export function createRegisterParentHandler(
  cognitoClient: CognitoClient,
  dbClient: DbClient,
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse request body
      if (!event.body) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_REQUEST',
            message: 'Request body is required',
          }),
        };
      }

      let body: ParentRegistrationBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          }),
        };
      }

      // Validate all fields
      const fieldErrors = validateFields(body);
      if (fieldErrors.length > 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Validation failed',
            fieldErrors,
          }),
        };
      }

      // Create Cognito user
      let cognitoSub: string;
      try {
        const result = await cognitoClient.createUser({
          username: body.username,
          password: body.password,
          email: body.email,
          phone: body.phone,
          name: body.name,
        });
        cognitoSub = result.cognitoSub;
      } catch (error: unknown) {
        const cognitoError = error as CognitoDuplicateError;
        // Only enforce username uniqueness — email and phone can be shared
        // between multiple parent accounts per product requirements
        if (cognitoError.code === 'UsernameExistsException' || cognitoError.duplicateField === 'username') {
          const message = DUPLICATE_MESSAGES['username'];
          return {
            statusCode: 409,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              statusCode: 409,
              errorCode: 'DUPLICATE_ENTRY',
              message,
              fieldErrors: [{ field: 'username', message }],
            }),
          };
        }
        throw error;
      }

      // Add user to "parent" group
      await cognitoClient.addUserToGroup({
        username: body.username,
        groupName: 'parent',
      });

      // Insert into parents table
      const parentId = randomUUID();
      await dbClient.insertParent({
        id: parentId,
        username: body.username,
        name: body.name,
        email: body.email,
        phone: body.phone,
        cognitoSub,
      });

      // Return success
      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'Parent registered successfully',
          parentId,
        }),
      };
    } catch {
      // Internal server error
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'Something went wrong — please try again after some time',
        }),
      };
    }
  };
}
