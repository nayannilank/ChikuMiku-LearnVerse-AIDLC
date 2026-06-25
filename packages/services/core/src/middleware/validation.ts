/**
 * Request Body Validation Middleware
 *
 * Validates incoming request bodies against a schema of field rules.
 * On failure, throws a ServiceError with VALIDATION_ERROR code and field-level details.
 */

import type { FieldError } from './errorHandler.js';
import { ServiceError } from './errorHandler.js';

// ============================================================
// Schema Types
// ============================================================

export interface FieldRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp | string;
  errorMessage?: string;
}

export interface ValidationSchema {
  [field: string]: FieldRule;
}

// ============================================================
// Validation Functions
// ============================================================

/**
 * Parses the request body JSON and validates each field against the provided schema.
 *
 * @returns The parsed and validated body as type T
 * @throws ServiceError with VALIDATION_ERROR code if validation fails
 */
export function validateBody<T>(body: string | null, schema: ValidationSchema): T {
  if (!body || body.trim().length === 0) {
    throw new ServiceError('Request body is required', 400, 'VALIDATION_ERROR');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ServiceError('Invalid JSON in request body', 400, 'VALIDATION_ERROR');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ServiceError('Request body must be a JSON object', 400, 'VALIDATION_ERROR');
  }

  const errors: FieldError[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = parsed[field];
    const error = validateField(value, rules);
    if (error) {
      errors.push({ field, message: error.message, value });
    }
  }

  if (errors.length > 0) {
    throw new ServiceError('Validation failed', 400, 'VALIDATION_ERROR', {
      fieldErrors: errors,
    });
  }

  return parsed as T;
}

/**
 * Validates a single field value against a set of rules.
 *
 * @returns A FieldError if validation fails, or null if valid
 */
export function validateField(value: unknown, rules: FieldRule): FieldError | null {
  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    return {
      field: '',
      message: rules.errorMessage ?? 'This field is required',
    };
  }

  // If value is absent and not required, skip remaining checks
  if (value === undefined || value === null) {
    return null;
  }

  // Type check
  if (rules.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      return {
        field: '',
        message: rules.errorMessage ?? `Expected type ${rules.type}, got ${actualType}`,
      };
    }
  }

  // String-specific checks
  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return {
        field: '',
        message: rules.errorMessage ?? `Must be at least ${rules.minLength} characters`,
      };
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return {
        field: '',
        message: rules.errorMessage ?? `Must be at most ${rules.maxLength} characters`,
      };
    }
    if (rules.pattern) {
      const regex = rules.pattern instanceof RegExp
        ? rules.pattern
        : new RegExp(rules.pattern);
      if (!regex.test(value)) {
        return {
          field: '',
          message: rules.errorMessage ?? 'Value does not match the required pattern',
        };
      }
    }
  }

  // Number-specific checks
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return {
        field: '',
        message: rules.errorMessage ?? `Must be at least ${rules.min}`,
      };
    }
    if (rules.max !== undefined && value > rules.max) {
      return {
        field: '',
        message: rules.errorMessage ?? `Must be at most ${rules.max}`,
      };
    }
  }

  return null;
}
