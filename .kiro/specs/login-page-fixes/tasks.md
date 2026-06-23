# Implementation Plan

## Overview

Fix four bugs on the LearnVerse login/registration pages: missing blur validation on registration form phone/email fields, missing forgot-password link on initial render, missing client-side validation on login form submission, and missing post-login navigation to dashboard. Uses exploratory bugfix workflow: write property tests first (to confirm bugs exist and capture preservation behavior), then implement fixes, then verify all tests pass.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Login Page Missing Validation & Navigation Bugs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all four bugs exist
  - **Scoped PBT Approach**: Scope properties to concrete failing cases for each bug condition
  - Create test file: `packages/platform-web/app/src/components/__tests__/LoginPageBugs.property.test.ts`
  - Setup: Configure vitest with jsdom environment for DOM testing
  - **Bug 1 - Blur Validation (Registration Form)**:
    - Generate random invalid phone strings (non-10-digit, contains letters) via `fc.string()` filtered to invalid patterns
    - Create `ParentRegistrationForm`, set phone input value, dispatch `blur` event
    - Assert: an inline error element (`form-group__error`) becomes visible below the phone field
    - Generate random invalid email strings via `fc.string()` filtered to non-email patterns
    - Create `ParentRegistrationForm`, set email input value, dispatch `blur` event
    - Assert: an inline error element becomes visible below the email field
  - **Bug 2 - Forgot Password Link (Login Form)**:
    - Create `LoginForm` with default options (any role)
    - Assert: a `.forgot-password-link` element OR element containing text "Forgot password?" exists in the DOM
  - **Bug 3 - Empty Credentials Validation (Login Form)**:
    - Generate random credential pairs where at least one of (username, password) is empty using `fc.record({ username: fc.oneof(fc.constant(''), fc.string()), password: fc.oneof(fc.constant(''), fc.string()) })` filtered to at least one empty
    - Create `LoginForm`, set input values, dispatch submit event
    - Assert: `onSubmit` callback was NOT called (submission was blocked)
    - Assert: inline validation error elements are visible for the empty field(s)
  - **Bug 4 - Post-Login Navigation (HomeView)**:
    - Create `HomeView`, simulate role selection and successful login
    - Assert: `window.location.hash` is set to `#dashboard`
  - Run test on UNFIXED code: `npx vitest run packages/platform-web/app/src/components/__tests__/LoginPageBugs.property.test.ts`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Input Behavior & Login Flow Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file: `packages/platform-web/app/src/components/__tests__/LoginPagePreservation.property.test.ts`
  - Setup: Configure vitest with jsdom environment for DOM testing
  - **Preservation 1 - Valid Phone/Email No Error on Blur**:
    - Observe: on unfixed code, blurring phone/email with valid values shows no errors (since blur listeners don't exist, nothing happens)
    - Generate random valid 10-digit phone strings via `fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), { minLength: 10, maxLength: 10 })`
    - Create `ParentRegistrationForm`, set phone input value to valid phone, dispatch `blur`
    - Assert: NO error element is displayed for the phone field
    - Generate random valid email strings via `fc.emailAddress()`
    - Create `ParentRegistrationForm`, set email input to valid email, dispatch `blur`
    - Assert: NO error element is displayed for the email field
  - **Preservation 2 - Non-Empty Credentials Login Flow**:
    - Observe: on unfixed code, non-empty credentials are sent to `onSubmit` with trimmed username
    - Generate random non-empty credential pairs via `fc.record({ username: fc.string({ minLength: 1 }), password: fc.string({ minLength: 1 }) })`
    - Create `LoginForm`, set inputs to non-empty values, dispatch submit
    - Assert: `onSubmit` IS called with the username (trimmed) and password values
  - **Preservation 3 - Submit-time Registration Validation**:
    - Observe: on unfixed code, submitting registration form with invalid data shows errors on submit
    - Create `ParentRegistrationForm`, leave fields empty, dispatch form submit
    - Assert: inline validation errors appear for required fields
  - **Preservation 4 - Login Failure Shows Error and Action Links**:
    - Observe: on unfixed code, when `onSubmit` throws, error message and failure actions are displayed
    - Create `LoginForm`, simulate submission that throws an error
    - Assert: error area becomes visible with the error message
    - Assert: failure actions (Register + Reset Password links) become visible
  - **Preservation 5 - Header Register Navigation**:
    - Observe: clicking Register button in header navigates to `#register`
    - Create `HomeView`, find and click the register button
    - Assert: `window.location.hash` changes to `#register`
  - Run tests on UNFIXED code: `npx vitest run packages/platform-web/app/src/components/__tests__/LoginPagePreservation.property.test.ts`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for login page missing validation and navigation bugs

  - [x] 3.1 Add blur event listeners to ParentRegistrationForm for phone and email fields
    - File: `packages/platform-web/app/src/components/ParentRegistrationForm.ts`
    - After creating each input element in the FIELDS loop, attach a `blur` event listener to the phone and email inputs
    - On blur: run the corresponding validation rule for that single field using the existing `VALIDATION_RULES` and `validate()` engine
    - If invalid: display the error message in the field's existing `errorEl` element (set `display: block`)
    - If valid: clear the error element (set `display: none`, clear innerHTML)
    - Extract a helper function `validateSingleField(fieldName, value)` to avoid duplicating validation logic between blur and submit
    - Reuse the existing `showInlineErrors` pattern but for a single field
    - _Bug_Condition: isBugCondition(input) where input.type == 'blur' AND input.field IN ['phone', 'email'] AND input.context == 'parentRegistrationForm' AND fieldValue is invalid_
    - _Expected_Behavior: Inline error element becomes visible below the field with appropriate message_
    - _Preservation: Valid phone/email on blur must NOT show errors; submit-time validation must continue working_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Add forgot-password link to LoginForm initial render
    - File: `packages/platform-web/app/src/components/LoginForm.ts`
    - Create an `<a>` element with class `forgot-password-link`, text "Forgot password?", href `#forgot-password`
    - Append it to the container after the form element and before the error area
    - Attach a click listener that calls `e.preventDefault()` then `onForgotPassword()`
    - The link must be visible on initial render (no dependency on `hasFailedOnce`)
    - _Bug_Condition: isBugCondition(input) where input.type == 'initialRender' AND input.context == 'loginForm' AND NOT forgotPasswordLinkVisible()_
    - _Expected_Behavior: .forgot-password-link element exists in DOM on initial render, is visible and clickable_
    - _Preservation: LoginFailureActions (Register + Reset Password) must still appear on failure only_
    - _Requirements: 2.3, 3.5_

  - [x] 3.3 Add client-side validation to LoginForm submit handler
    - File: `packages/platform-web/app/src/components/LoginForm.ts`
    - Create inline validation error `<span>` elements for username and password (with `role="alert"`, class `validation-error`, initially hidden)
    - Append error spans after each input element in their respective form groups
    - In the submit handler, BEFORE calling `onSubmit`: check if `usernameInput.value.trim() === ''` or `passwordInput.value === ''`
    - If username is empty: show "Username is required" error, set `display: block`
    - If password is empty: show "Password is required" error, set `display: block`
    - If either is empty: return early without calling `onSubmit`
    - Add a `clearValidation()` function called at the start of each submit to reset error elements
    - _Bug_Condition: isBugCondition(input) where input.type == 'formSubmit' AND (isEmpty(username) OR isEmpty(password))_
    - _Expected_Behavior: Submission blocked, inline errors shown for empty fields, onSubmit NOT called_
    - _Preservation: Non-empty credentials must still pass through to onSubmit; login failure must still show error + actions_
    - _Requirements: 2.4, 2.5, 2.6, 3.4, 3.5_

  - [x] 3.4 Add post-login navigation to HomeView
    - File: `packages/platform-web/app/src/views/HomeView.ts`
    - In the `onSubmit` callback, inside the `if (result.success)` block, add `window.location.hash = '#dashboard'`
    - Place the hash change after building the welcome card (or instead of it — since router will re-render on hash change)
    - Optionally add a dashboard route in `main.ts` (`pattern: /^dashboard$/`) that renders a placeholder or the welcome card
    - _Bug_Condition: isBugCondition(input) where input.type == 'loginSuccess' AND NOT navigationTriggered()_
    - _Expected_Behavior: window.location.hash is set to '#dashboard' on successful login_
    - _Preservation: Login failure behavior must remain unchanged; Register navigation must still work_
    - _Requirements: 2.7, 3.4, 3.5, 3.6_

  - [x] 3.5 Add dashboard route to main.ts (optional but recommended)
    - File: `packages/platform-web/app/src/main.ts`
    - Add a new route entry: `{ pattern: /^dashboard$/, handler: () => createDashboardPlaceholder() }`
    - Create a simple placeholder function that returns a welcome/dashboard element
    - This prevents the router fallback from re-rendering HomeView after successful navigation
    - _Requirements: 2.7_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Login Page Missing Validation & Navigation Bugs Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `npx vitest run packages/platform-web/app/src/components/__tests__/LoginPageBugs.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms all four bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Input Behavior & Login Flow Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `npx vitest run packages/platform-web/app/src/components/__tests__/LoginPagePreservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest run packages/platform-web/app/src/components/__tests__/`
  - Verify all property-based tests pass (both bug condition and preservation)
  - Verify TypeScript compilation: `npx tsc --noEmit -p packages/platform-web/app/tsconfig.json`
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "tasks": ["1", "2"]
    },
    {
      "tasks": ["3.1", "3.2", "3.3", "3.4"]
    },
    {
      "tasks": ["3.5"]
    },
    {
      "tasks": ["3.6", "3.7"]
    },
    {
      "tasks": ["4"]
    }
  ]
}
```

## Notes

- Test files use `.property.test.ts` suffix to match the vitest include patterns in the root `vitest.config.ts`
- The project uses `fast-check` 3.22.0 (available as root devDependency) for property-based testing
- jsdom environment must be specified via `@vitest-environment jsdom` comment or vitest config override since the root config uses `environment: 'node'`
- The `LoginForm.ts` component currently has NO validation logic and NO forgot-password link — it relies entirely on the API
- The `ParentRegistrationForm.ts` has validation infrastructure (ValidationEngine, error elements) but only invokes it on form submit, not on blur
- The `HomeView.ts` renders a welcome card on success but never changes `window.location.hash`
- Mock the `loginWithRole` service in tests to avoid actual API calls and control success/failure scenarios
