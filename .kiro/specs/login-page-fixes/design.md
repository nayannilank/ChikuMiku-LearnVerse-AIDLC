# Login Page Fixes Bugfix Design

## Overview

This design addresses four interrelated bugs on the LearnVerse web application login and registration pages. The bugs span missing inline (blur) validation on the registration form, a hidden forgot-password link, absent client-side validation on the login form, and lack of post-login navigation. The fix approach is minimal and targeted — each bug has a well-defined root cause in a specific file, and the changes are isolated to avoid regressions on working functionality.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger any of the four defective behaviors — blur without inline validation, initial render without forgot-password link, empty credential submission, or successful login without navigation
- **Property (P)**: The desired correct behavior for each bug condition — inline errors on blur, visible forgot-password link on render, blocked empty submissions, and hash navigation on success
- **Preservation**: Existing behaviors that must remain unchanged — submit-time validation, mouse interactions, error display on API failure, Register button navigation, and existing login flow for valid credentials
- **`createParentRegistrationForm`**: Factory function in `ParentRegistrationForm.ts` that builds the parent registration form DOM element
- **`createLoginForm`**: Factory function in `LoginForm.ts` that builds the role-aware login form DOM element
- **`createHomeView`**: Factory function in `HomeView.ts` that assembles the home page including login flow and post-login behavior
- **`ValidationEngine`**: Module providing `validate()`, `phoneValidator()`, `emailValidator()`, and other validators used for field validation

## Bug Details

### Bug Condition

The bugs manifest across four distinct scenarios in the login/registration flow. The `createParentRegistrationForm` lacks blur event listeners on phone/email inputs; `createLoginForm` has no forgot-password link and no client-side validation; and `createHomeView` does not navigate after successful login.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserInteraction
  OUTPUT: boolean

  RETURN (input.type == 'blur' AND input.field IN ['phone', 'email']
          AND input.context == 'parentRegistrationForm'
          AND fieldValue(input.field) is invalid
          AND NOT inlineErrorDisplayed(input.field))
      OR (input.type == 'initialRender' AND input.context == 'loginForm'
          AND NOT forgotPasswordLinkVisible())
      OR (input.type == 'formSubmit' AND input.context == 'loginForm'
          AND (isEmpty(usernameField) OR isEmpty(passwordField))
          AND NOT submissionBlocked())
      OR (input.type == 'loginSuccess' AND input.context == 'homeView'
          AND NOT navigationTriggered())
END FUNCTION
```

### Examples

- User types "abc" in the phone field of the parent registration form and tabs to the next field → **Expected**: inline error "Phone must be exactly 10 digits" appears below the phone field. **Actual**: No error until form submission.
- User types "not-an-email" in the email field and tabs away → **Expected**: inline error "Please enter a valid email address" appears. **Actual**: No error until form submission.
- User loads the login page for the first time (no prior failure) → **Expected**: "Forgot password?" link visible below the form. **Actual**: Link is absent; only appears after a login failure via the failure actions section.
- User clicks "Log In" with both fields empty → **Expected**: Submission is blocked with inline "Username is required" and "Password is required" errors. **Actual**: Empty strings are sent to the API.
- User successfully logs in → **Expected**: Browser navigates to `#dashboard`. **Actual**: A static welcome card replaces the content with no route change.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Submit-time validation on the parent registration form must continue to work (all fields validated on submit, errors displayed)
- Valid phone/email values must NOT show errors on blur
- Login form with both fields filled must continue to send credentials to the API
- Login failure must continue to display error message and show Register/Reset Password links
- Register button in header must continue to navigate to `#register`
- Authentication API unreachable must continue to display network error message
- The forgot-password link, once added, must navigate to `#forgot-password` on click

**Scope:**
All inputs that do NOT involve the four bug conditions should be completely unaffected by this fix. This includes:
- Valid data entry in the registration form (no spurious blur errors)
- Login submissions with both fields populated (credentials sent normally)
- Navigation to other routes (register, forgot-password, reset-password)
- API error handling and display

## Hypothesized Root Cause

Based on the bug analysis and source code inspection:

1. **Missing blur event listeners (Bug #1)**: `ParentRegistrationForm.ts` builds input elements and attaches validation rules, but only runs `validate()` inside the form `submit` event handler. No `blur` or `focusout` listeners are attached to the phone or email inputs. The `ValidationEngine` infrastructure exists and works — it's simply not invoked on blur.

2. **Forgot-password link not rendered initially (Bug #2)**: `LoginForm.ts` (the component actually used in `HomeView`) does not create a forgot-password link element at all. It only creates `failureActions` (Register + Reset Password links) that are revealed on first failure. The separate `LoginCard.ts` component has a forgot-password link but is not used in the current routing setup.

3. **No client-side validation on login form (Bug #3)**: `LoginForm.ts` submit handler directly reads input values and calls `onSubmit(username, password, role)` without any validation check. Unlike `LoginCard.ts` which has a `validate()` function, `LoginForm.ts` has no validation logic whatsoever — it relies entirely on the API to reject bad input.

4. **No post-login navigation (Bug #4)**: `HomeView.ts` handles successful login by replacing `main.innerHTML` with a welcome card element. It never sets `window.location.hash = '#dashboard'` or triggers any route change. The router would handle the transition if the hash were updated, but it's not.

## Correctness Properties

Property 1: Bug Condition - Inline Blur Validation on Registration

_For any_ blur event on the phone or email input field in the parent registration form where the field value is invalid, the fixed `createParentRegistrationForm` function SHALL display an inline validation error message below that field immediately on blur, without requiring form submission.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Forgot Password Link Visibility

_For any_ initial render of the login form (regardless of prior login attempts), the fixed `createLoginForm` function SHALL include a visible "Forgot password?" link element in the DOM that is accessible and clickable without requiring a prior login failure.

**Validates: Requirements 2.3**

Property 3: Bug Condition - Empty Credential Validation

_For any_ login form submission where the username field is empty OR the password field is empty, the fixed `createLoginForm` function SHALL prevent the form from being submitted to the API and SHALL display inline validation error messages for each empty required field.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 4: Bug Condition - Post-Login Navigation

_For any_ successful login response, the fixed `createHomeView` function SHALL set `window.location.hash` to `#dashboard`, triggering a route change via the HashRouter.

**Validates: Requirements 2.7**

Property 5: Preservation - Registration Submit Validation Unchanged

_For any_ form submission on the parent registration form, the fixed code SHALL produce the same validation behavior as the original code — all fields are validated on submit, errors are displayed for invalid fields, and valid submissions proceed to the API.

**Validates: Requirements 3.3**

Property 6: Preservation - Valid Credentials Login Flow Unchanged

_For any_ login form submission where both username and password fields are non-empty, the fixed code SHALL continue to send credentials to the authentication API and handle success/failure responses identically to the original behavior.

**Validates: Requirements 3.4, 3.5, 3.7**

Property 7: Preservation - Header Register Navigation Unchanged

_For any_ click on the Register button in the header, the fixed code SHALL continue to navigate to `#register` exactly as before.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/platform-web/app/src/components/ParentRegistrationForm.ts`

**Function**: `createParentRegistrationForm`

**Specific Changes**:
1. **Add blur event listeners for phone and email fields**: After creating the input elements, attach `blur` (or `focusout`) event listeners to the phone and email inputs that run the corresponding validation rule and display/clear the inline error element.
2. **Extract per-field validation logic**: Create a helper function (e.g., `validateField(fieldName, value)`) that runs the validators for a single field and returns the error message (or null). This can be called both on blur and on submit to avoid duplication.

---

**File**: `packages/platform-web/app/src/components/LoginForm.ts`

**Function**: `createLoginForm`

**Specific Changes**:
1. **Add forgot-password link element**: Create an `<a>` element with class `forgot-password-link`, text "Forgot password?", and href `#forgot-password`. Append it to the container after the form element (before the error area). Attach a click listener that calls `onForgotPassword()`.
2. **Add inline validation error elements**: Create error `<span>` elements for username and password (similar to `LoginCard.ts` pattern) with `role="alert"` and initially hidden.
3. **Add validation logic in submit handler**: Before calling `onSubmit`, check if username is empty (after trim) and/or password is empty. If either is empty, display the appropriate inline error and return early without calling `onSubmit`.
4. **Add `clearValidation` call**: Clear inline errors at the start of each submit attempt.

---

**File**: `packages/platform-web/app/src/views/HomeView.ts`

**Function**: `createHomeView` (inside the `onSubmit` callback)

**Specific Changes**:
1. **Add hash navigation on success**: After the `if (result.success)` block, before or after rendering the welcome card, set `window.location.hash = '#dashboard'`. This will trigger the HashRouter to render the dashboard view.
2. **Consider removing welcome card**: Since the router will re-render the mount point on hash change, the welcome card may be unnecessary. However, if no `#dashboard` route exists yet, the fallback (HomeView) will render. For now, set the hash to `#dashboard` — a dashboard route can be added in the tasks phase or it can gracefully fallback.

---

**File**: `packages/platform-web/app/src/main.ts`

**Function**: `initApp`

**Specific Changes**:
1. **Add dashboard route** (optional but recommended): Add a route entry for `pattern: /^dashboard$/` that renders a dashboard view or placeholder. Without this, the router fallback will re-render HomeView after navigation.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate all four bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests using Vitest + jsdom that exercise each bug scenario on the current unfixed code. These tests should fail, confirming the bugs exist as described.

**Test Cases**:
1. **Blur Validation Test**: Create `ParentRegistrationForm`, set phone input to "abc", dispatch a blur event → assert that an inline error element becomes visible (will fail on unfixed code)
2. **Blur Email Validation Test**: Create `ParentRegistrationForm`, set email input to "not-email", dispatch blur → assert inline error visible (will fail on unfixed code)
3. **Forgot Password Link Test**: Create `LoginForm` with default options → query for `.forgot-password-link` or link containing "Forgot password" text → assert it exists in the DOM (will fail on unfixed code)
4. **Empty Credentials Test**: Create `LoginForm`, dispatch submit with empty fields → assert `onSubmit` was NOT called (will fail on unfixed code — onSubmit IS called)
5. **Post-Login Navigation Test**: Create `HomeView`, simulate successful login → assert `window.location.hash` contains "dashboard" (will fail on unfixed code)

**Expected Counterexamples**:
- Blur events on phone/email produce no visible error elements
- No forgot-password link element in `LoginForm` DOM output
- `onSubmit` is called with empty strings
- `window.location.hash` remains unchanged after successful login

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many valid phone/email/credential combinations to verify no false positives on blur validation
- It generates varied non-empty credential pairs to verify login submission still works
- It catches edge cases (whitespace-only inputs, boundary-length values) that manual tests miss

**Test Plan**: Observe behavior on UNFIXED code first for valid inputs and normal login flows, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Valid Phone Blur Preservation**: Generate random valid 10-digit phone strings, blur the phone field → assert NO error is displayed
2. **Valid Email Blur Preservation**: Generate random valid email strings, blur the email field → assert NO error is displayed
3. **Non-Empty Credentials Submission**: Generate random non-empty username/password pairs → assert `onSubmit` IS called with those values
4. **Submit Validation Preservation**: Generate form data with various valid/invalid combos → assert submit-time validation continues to work identically
5. **Forgot Password Link Click**: Assert clicking the newly visible forgot-password link calls `onForgotPassword` callback

### Unit Tests

- Test blur validation triggers for phone field with invalid values
- Test blur validation triggers for email field with invalid values
- Test blur validation does NOT trigger for valid phone/email values
- Test forgot-password link is present in LoginForm DOM on initial render
- Test forgot-password link click calls onForgotPassword callback
- Test empty username blocks submission and shows error
- Test empty password blocks submission and shows error
- Test both empty blocks submission and shows both errors
- Test non-empty credentials pass through validation and call onSubmit
- Test successful login sets window.location.hash to '#dashboard'

### Property-Based Tests

- Generate random invalid phone strings (non-10-digit, contains letters) → verify blur always shows error
- Generate random valid phone strings (exactly 10 digits) → verify blur never shows error
- Generate random invalid email strings → verify blur always shows error
- Generate random valid email strings → verify blur never shows error
- Generate random (possibly empty) credential pairs → verify submission is blocked if and only if username or password is empty
- Generate random non-empty credential pairs → verify onSubmit is always called with correct trimmed values

### Integration Tests

- Test full registration flow: select parent role → fill form → blur phone with invalid → see error → fix phone → blur → error clears → submit
- Test full login flow: select role → see forgot-password link → click it → navigates to forgot-password view
- Test full login flow: select role → submit empty → see errors → fill fields → submit → success → hash changes to dashboard
- Test login failure flow: fill credentials → submit → API error → error displayed → Register/Reset Password links visible
