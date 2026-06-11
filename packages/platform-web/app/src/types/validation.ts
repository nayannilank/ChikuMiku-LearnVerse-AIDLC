/**
 * Shared validation type definitions for the LearnVerse web application.
 *
 * These types define the contract for the declarative Validation_Engine used
 * across all forms (login, registration, password reset).
 */

/**
 * A validator function that checks a single string value.
 * Returns `null` when the value is valid, or an error message string when invalid.
 */
export type ValidatorFn = (value: string) => string | null;

/**
 * Associates a form field name with an ordered list of validators.
 * Validators are evaluated in order; the first failure short-circuits.
 */
export interface FieldRule {
  fieldName: string;
  validators: ValidatorFn[];
}

/**
 * The result of running the validation engine against a set of field values.
 * - `valid`: true when all fields pass all validators
 * - `errors`: maps each failing field name to its first error message
 */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
