# Implementation Plan: Registration and Password Reset

## Overview

This plan implements role-based login, conditional registration (parent-direct, student-via-parent), and password reset flows for the ChikuMiku LearnVerse web application. The implementation uses the existing vanilla TypeScript + DOM manipulation pattern with factory-function components, hash-based routing, and the existing AuthService/escapeHtml utilities.

## Tasks

- [x] 1. Set up shared types, validation engine, and hash router
  - [x] 1.1 Create shared type definitions and ServiceResult interface
    - Create `src/types/auth.ts` with `UserRole`, `ServiceResult<T>`, `LoginRequest`, `LoginSuccessData`, `ParentRegistrationRequest`, `StudentRegistrationRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`
    - Create `src/types/validation.ts` with `ValidatorFn`, `FieldRule`, `ValidationResult`
    - _Requirements: 1.3, 4.1–4.9, 5.1, 6.2, 8.1–8.8, 9.1, 10.4, 11.5_

  - [x] 1.2 Implement the ValidationEngine module
    - Create `src/validation/ValidationEngine.ts` with the `validate(rules, values)` function
    - Implement individual validator factories: `lengthValidator(min, max)`, `charsetValidator(pattern)`, `emailValidator()`, `phoneValidator()`, `requiredValidator()`, `matchValidator(otherFieldName)`
    - All validators return `null` on success or an error message string on failure
    - _Requirements: 4.1–4.9, 8.1–8.8, 11.2–11.4, 13.3_

  - [x] 1.3 Write property tests for ValidationEngine (Properties 1, 2, 3, 4, 6, 7)
    - **Property 1: Length validator accepts if and only if string length is within bounds**
    - **Property 2: Character-set validator accepts if and only if all characters match the allowed pattern**
    - **Property 3: Email validator rejects strings that exceed max length or lack valid email structure**
    - **Property 4: Password match validator rejects if and only if the two strings differ**
    - **Property 6: Validation engine returns errors only for fields that fail rules**
    - **Property 7: Phone number validator accepts exactly 10-digit strings**
    - Create `src/validation/ValidationEngine.property.test.ts` using fast-check
    - **Validates: Requirements 4.1–4.8, 8.1–8.6, 11.2–11.4**

  - [x] 1.4 Write unit tests for ValidationEngine
    - Create `src/validation/ValidationEngine.test.ts`
    - Test each validator with specific edge cases (boundary lengths, empty strings, special characters)
    - Test `validate()` function returns correct `ValidationResult` shape
    - _Requirements: 4.1–4.9, 8.1–8.8, 11.2–11.4_

  - [x] 1.5 Implement the HashRouter module
    - Create `src/router/HashRouter.ts` implementing `createRouter(options: RouterOptions)`
    - Listen to `hashchange` event and initial load
    - Match hash against route patterns, extract params (e.g., token from `#reset-password?token=x`)
    - Clear mount point and append matched handler's element
    - Fall back to home view for unrecognized hashes
    - Return `{ destroy }` for cleanup
    - _Requirements: 12.4_

  - [x] 1.6 Write property test for HashRouter (Property 5)
    - **Property 5: Router renders fallback view for any unrecognized hash**
    - Create `src/router/HashRouter.property.test.ts` using fast-check with jsdom
    - **Validates: Requirements 12.4**

  - [x] 1.7 Write unit tests for HashRouter
    - Create `src/router/HashRouter.test.ts`
    - Test known routes render correct views
    - Test hash changes swap views without page reload
    - Test token parameter extraction from reset-password hash
    - _Requirements: 12.4_

- [x] 2. Checkpoint - Ensure validation and routing foundations pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Extend AuthService with new API functions
  - [x] 3.1 Add new AuthService functions
    - Add `loginWithRole(username, password, role)` → POST `/api/v1/auth/login` with role
    - Add `registerParent(data)` → POST `/api/v1/auth/register/parent`
    - Add `registerStudent(data, token)` → POST `/api/v1/auth/register/student` with Authorization header
    - Add `forgotPassword(identifier)` → POST `/api/v1/auth/forgot-password`
    - Add `resetPassword(token, newPassword)` → POST `/api/v1/auth/reset-password`
    - All functions return `Promise<ServiceResult<T>>` with mock responses until backend is ready
    - Use `escapeHtml()` for any error messages rendered to DOM
    - _Requirements: 1.3, 5.1, 6.2, 9.1, 10.4, 11.5_

  - [x] 3.2 Write unit tests for AuthService extensions
    - Create or extend `src/services/AuthService.test.ts`
    - Test each new function returns correct ServiceResult shape
    - Test error handling (network failure, 4xx, 5xx responses)
    - Mock fetch for all tests
    - _Requirements: 1.3, 5.1, 6.2, 9.1, 10.4, 11.5_

- [x] 4. Implement HomeView with RoleSelector and LoginForm
  - [x] 4.1 Create RoleSelector component
    - Create `src/components/RoleSelector.ts` with `createRoleSelector(options: RoleSelectorOptions)`
    - Render fieldset with legend, two radio buttons ("Parent", "Student")
    - Fire `onRoleSelected` callback on change
    - Use proper accessibility: fieldset/legend, labels for radio inputs
    - _Requirements: 1.1, 13.4_

  - [x] 4.2 Create LoginForm component (refactored from LoginCard)
    - Create `src/components/LoginForm.ts` with `createLoginForm(options: LoginFormOptions)`
    - Render username + password inputs with labels (matching for/id)
    - Submit button with loading state (disabled + indicator while in progress)
    - On failure: show error message + LoginFailureActions ("Register" link → `#register`, "Reset Password" link → `#forgot-password`)
    - LoginFailureActions hidden until first failure
    - Pass error messages through `escapeHtml()` before DOM insertion
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 13.1, 13.2_

  - [x] 4.3 Create HomeView assembling Header, BackgroundWatermark, RoleSelector, and LoginForm
    - Create `src/views/HomeView.ts` with `createHomeView()`
    - Compose existing Header, BackgroundWatermark with new RoleSelector → LoginForm flow
    - Role selection shows LoginForm; LoginForm failure shows actions
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8_

  - [x] 4.4 Write unit tests for HomeView components
    - Create `src/views/HomeView.test.ts`
    - Test RoleSelector renders two radio buttons in fieldset/legend
    - Test selecting a role shows LoginForm
    - Test LoginForm shows username/password inputs with labels
    - Test submit triggers API call with correct payload
    - Test loading state disables button
    - Test failed login shows error + failure actions
    - Test failure actions navigate to correct hashes
    - _Requirements: 1.1–1.8, 13.1–13.4_

- [x] 5. Implement RegistrationView with all sub-screens
  - [x] 5.1 Create RoleChoiceScreen component
    - Create `src/components/RoleChoiceScreen.ts` with `createRoleChoiceScreen(options)`
    - Render two radio options ("Parent", "Student") inside fieldset with legend
    - Fire `onChoice` callback on selection
    - _Requirements: 2.1, 13.5_

  - [x] 5.2 Create ParentRegistrationForm component
    - Create `src/components/ParentRegistrationForm.ts` with `createParentRegistrationForm(options)`
    - Render fields: username, name, phone, email, password — each with visible label
    - Submit button labeled "Register Parent" with loading state
    - On submit: validate using ValidationEngine → call `registerParent` → show success → navigate to `#` after 3s with "Go to Login" fallback link
    - On API error: display error below form
    - Inline validation errors with `aria-describedby`
    - _Requirements: 3.1–3.6, 4.1–4.9, 5.1–5.4, 13.2, 13.3_

  - [x] 5.3 Create ParentLoginGate component
    - Create `src/components/ParentLoginGate.ts` with `createParentLoginGate(options)`
    - Render login form with username + password fields and "Login as Parent" button
    - On submit: call `loginWithRole` with role "parent" → pass token to `onAuthenticated` callback
    - Loading state and error display
    - _Requirements: 6.1–6.5_

  - [x] 5.4 Create StudentRegistrationForm component
    - Create `src/components/StudentRegistrationForm.ts` with `createStudentRegistrationForm(options)`
    - Render fields: parent username (read-only with `aria-readonly="true"`), student username, name, grade dropdown (LKG through Twelfth), school name — each with visible label
    - Submit button labeled "Register Student" with loading state
    - On submit: validate → call `registerStudent` with token → show success → navigate to `#` after 3s with "Go to Login" fallback link
    - On API error: display error below form
    - Inline validation errors with `aria-describedby`
    - _Requirements: 7.1–7.7, 8.1–8.8, 9.1–9.4, 13.2, 13.3, 13.6_

  - [x] 5.5 Create RegistrationView assembling all sub-screens with state machine
    - Create `src/views/RegistrationView.ts` with `createRegistrationView()`
    - Internal state machine: RoleChoiceScreen → (Parent → ParentRegistrationForm) | (Student → ParentLoginGate → StudentRegistrationForm)
    - Include "Back to Login" link navigating to `#`
    - _Requirements: 2.1–2.3, 12.1_

  - [x] 5.6 Write unit tests for RegistrationView and sub-components
    - Create `src/views/RegistrationView.test.ts`
    - Test role choice renders two options
    - Test parent selection shows parent form
    - Test student selection shows parent login gate
    - Test parent form has all required fields with labels
    - Test student form has read-only parent username with aria-readonly
    - Test success responses show message + navigate after 3s with fallback link
    - Test error responses display below form
    - Test parent login gate stores token and transitions
    - _Requirements: 2.1–2.3, 3.1–3.6, 5.2–5.4, 6.1–6.5, 7.1–7.7, 9.2–9.4, 13.5, 13.6_

- [x] 6. Checkpoint - Ensure registration flow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement ForgotPasswordView and ResetPasswordView
  - [x] 7.1 Create ForgotPasswordView
    - Create `src/views/ForgotPasswordView.ts` with `createForgotPasswordView()`
    - Render single input labeled "Parent Username or Email" with helper text explaining reset link goes to parent's email
    - Submit button labeled "Send Reset Link" with loading state
    - On submit with non-empty value: call `forgotPassword` → show confirmation
    - On empty submit: show validation error (hide API error if visible)
    - On API error: display below form, hide inline validation errors
    - Include "Back to Login" link navigating to `#`
    - _Requirements: 10.1–10.8, 12.2, 13.1, 13.2_

  - [x] 7.2 Create ResetPasswordView
    - Create `src/views/ResetPasswordView.ts` with `createResetPasswordView(token: string)`
    - Render New Password and Confirm Password fields with labels
    - Validate: length 8–20, allowed characters, passwords must match
    - Submit button with loading state (persists until resolve/reject)
    - On success: show success message + navigate to `#` after 3s
    - On API error: display below form
    - Include "Back to Login" link navigating to `#`
    - _Requirements: 11.1–11.8, 12.3, 13.1, 13.2, 13.3_

  - [x] 7.3 Write unit tests for ForgotPasswordView and ResetPasswordView
    - Create `src/views/ForgotPasswordView.test.ts` and `src/views/ResetPasswordView.test.ts`
    - Test forgot password renders input + helper text + submit button
    - Test reset password renders two password fields
    - Test success messages and navigation
    - Test API error hides inline validation errors (error priority rule)
    - _Requirements: 10.1–10.8, 11.1–11.8_

- [x] 8. Wire everything together in main.ts with HashRouter
  - [x] 8.1 Refactor main.ts to use HashRouter
    - Replace current inline rendering with `createRouter` initialization
    - Define routes: `#` → HomeView, `#register` → RegistrationView, `#forgot-password` → ForgotPasswordView, `#reset-password?token=` → ResetPasswordView
    - Mount point is `#app` container
    - Fallback route renders HomeView
    - _Requirements: 12.4_

  - [x] 8.2 Add CSS styles for new components
    - Extend `src/styles/home.css` or create additional stylesheets for registration, forgot-password, and reset-password views
    - Style form fields, error messages, loading indicators, success messages, role selector, and navigation links
    - _Requirements: 1.1, 3.1–3.6, 7.1–7.7, 10.1, 11.1_

  - [x] 8.3 Write integration tests for full navigation flow
    - Create `src/integration/Navigation.test.ts`
    - Test hash changes render correct views
    - Test navigation from login failure actions to register and forgot-password
    - Test "Back to Login" links work from all views
    - Test unknown hashes fall back to HomeView
    - _Requirements: 1.7, 1.8, 12.1–12.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All error messages are passed through `escapeHtml()` before DOM insertion to prevent XSS
- AuthService functions return mock responses until backend is implemented
- The existing `createLoginCard` component will be superseded by the new `LoginForm` + `RoleSelector` pattern

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.5", "3.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.6", "1.7", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "5.1"] },
    { "id": 4, "tasks": ["4.3", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["4.4", "5.5", "7.1", "7.2"] },
    { "id": 6, "tasks": ["5.6", "7.3"] },
    { "id": 7, "tasks": ["8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3"] }
  ]
}
```
