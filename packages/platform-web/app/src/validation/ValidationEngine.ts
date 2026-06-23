/**
 * ValidationEngine module for the LearnVerse web application.
 *
 * Provides a declarative, reusable validation system with individual validator
 * factories and a central `validate` function that evaluates rules in order,
 * short-circuiting on the first failure per field.
 */

import type { ValidatorFn, FieldRule, ValidationResult } from '../types/validation';

/**
 * Creates a validator that checks if the string length is within [min, max].
 * Returns null if valid, or an error message string if invalid.
 */
export function lengthValidator(min: number, max: number): ValidatorFn {
  return (value: string): string | null => {
    if (value.length < min || value.length > max) {
      return `Must be between ${min} and ${max} characters`;
    }
    return null;
  };
}

/**
 * Creates a validator that checks if ALL characters in the string match the given regex pattern.
 * The pattern should describe a single allowed character (e.g., /[a-zA-Z0-9_-]/).
 * Returns null if valid, or an error message string if invalid.
 */
export function charsetValidator(pattern: RegExp): ValidatorFn {
  return (value: string): string | null => {
    for (const char of value) {
      if (!pattern.test(char)) {
        return `Contains invalid characters`;
      }
    }
    return null;
  };
}

/**
 * Creates a validator that checks for valid email format.
 * Accepts if length <= 30 AND contains exactly one @ with non-empty local and domain parts.
 * Returns null if valid, or an error message string if invalid.
 */
export function emailValidator(): ValidatorFn {
  return (value: string): string | null => {
    if (value.length > 30) {
      return `Email must be 30 characters or less`;
    }
    const atIndex = value.indexOf('@');
    const lastAtIndex = value.lastIndexOf('@');
    // Must have exactly one @
    if (atIndex === -1 || atIndex !== lastAtIndex) {
      return `Invalid email format`;
    }
    const local = value.substring(0, atIndex);
    const domain = value.substring(atIndex + 1);
    // Both local and domain must be non-empty
    if (local.length === 0 || domain.length === 0) {
      return `Invalid email format`;
    }
    // Domain must contain at least one dot (e.g., example.com)
    if (!domain.includes('.')) {
      return `Invalid email format`;
    }
    return null;
  };
}

/**
 * Creates a validator that checks if the value is exactly 10 digits.
 * Returns null if valid, or an error message string if invalid.
 */
export function phoneValidator(): ValidatorFn {
  return (value: string): string | null => {
    if (!/^\d{10}$/.test(value)) {
      return `Phone number must be exactly 10 digits`;
    }
    return null;
  };
}

/**
 * Creates a validator that rejects empty or whitespace-only strings.
 * Returns null if valid, or an error message string if invalid.
 */
export function requiredValidator(): ValidatorFn {
  return (value: string): string | null => {
    if (value.trim().length === 0) {
      return `This field is required`;
    }
    return null;
  };
}

/**
 * Symbol used to brand context-aware validators that need the values map.
 */
const CONTEXT_AWARE_BRAND = Symbol('contextAwareValidator');

/**
 * A context-aware validator function that receives the full values map
 * before producing the actual ValidatorFn.
 */
export interface ContextAwareValidator {
  (values: Record<string, string>): ValidatorFn;
  [CONTEXT_AWARE_BRAND]: true;
}

/**
 * Creates a context-aware validator that checks if the value matches another field's value.
 * The returned validator is branded so the validate function can resolve it with the values map.
 */
export function matchValidator(otherFieldName: string): ContextAwareValidator {
  const fn = ((values: Record<string, string>): ValidatorFn => {
    return (value: string): string | null => {
      if (value !== values[otherFieldName]) {
        return `Must match ${otherFieldName}`;
      }
      return null;
    };
  }) as ContextAwareValidator;

  fn[CONTEXT_AWARE_BRAND] = true;
  return fn;
}

/**
 * Type guard to determine if a validator entry is context-aware.
 */
function isContextAwareValidator(
  validator: ValidatorFn | ContextAwareValidator
): validator is ContextAwareValidator {
  return (validator as ContextAwareValidator)[CONTEXT_AWARE_BRAND] === true;
}

/**
 * A validator entry in a field rule: either a simple ValidatorFn or a
 * context-aware validator (like matchValidator) that needs the values map.
 */
export type ValidatorEntry = ValidatorFn | ContextAwareValidator;

/**
 * Extended field rule that supports both simple validators and context-aware validators.
 */
export interface ExtendedFieldRule {
  fieldName: string;
  validators: ValidatorEntry[];
}

/**
 * Validates a set of field values against an array of field rules.
 *
 * Validators are evaluated in order per field; the first failure short-circuits
 * (no further validators are run for that field).
 *
 * Supports both simple ValidatorFn entries and context-aware validators
 * (like matchValidator) that need access to the full values map.
 *
 * Returns `{ valid: true, errors: {} }` if all pass.
 * Returns `{ valid: false, errors: { fieldName: "first error" } }` if any fail.
 */
export function validate(rules: ExtendedFieldRule[], values: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  for (const rule of rules) {
    const value = values[rule.fieldName] ?? '';

    for (const validator of rule.validators) {
      let validatorFn: ValidatorFn;

      if (isContextAwareValidator(validator)) {
        validatorFn = validator(values);
      } else {
        validatorFn = validator;
      }

      const error = validatorFn(value);
      if (error !== null) {
        errors[rule.fieldName] = error;
        break; // Short-circuit: stop on first failure for this field
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
