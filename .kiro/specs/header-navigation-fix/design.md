# Header Navigation Fix — Bugfix Design

## Overview

After successful login, the application navigates to `#dashboard` which renders a bare placeholder (`createDashboardPlaceholder`) without the header component. The existing `createHeader` component only supports a "Register" button for unauthenticated pages. The fix involves creating an authenticated header variant with logout and home buttons, and integrating it into the dashboard view so that navigation is consistent across authenticated pages.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when a user is on the `#dashboard` route after login, the header is missing and there are no logout/home controls
- **Property (P)**: The desired behavior — the dashboard page displays a header with logo, home button, and logout button
- **Preservation**: Existing home page header with Register button, registration view's "Back to Login" link, and forgot/reset password views must remain unchanged
- **createHeader**: The function in `src/components/Header.ts` that creates a header element with logo and Register button (unauthenticated variant)
- **createDashboardPlaceholder**: The inline function in `src/main.ts` that creates a bare dashboard view without any header or navigation
- **HashRouter**: The router in `src/router/HashRouter.ts` that clears the mount point and renders route-matched views

## Bug Details

### Bug Condition

The bug manifests when a user successfully logs in and is navigated to the `#dashboard` route. The `createDashboardPlaceholder` function renders only a heading and paragraph, without invoking any header component. Additionally, no logout or home button exists anywhere in the authenticated UI, so even if the header were present, those controls would be missing.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NavigationEvent
  OUTPUT: boolean
  
  RETURN input.route == "dashboard"
         AND input.userAuthenticated == true
         AND headerComponentNotRendered(input.renderedDOM)
         AND logoutButtonNotPresent(input.renderedDOM)
         AND homeButtonNotPresent(input.renderedDOM)
END FUNCTION
```

### Examples

- User logs in as Parent, navigated to `#dashboard` → sees only "Dashboard" heading and a paragraph, no logo or nav buttons
- User logs in as Student, navigated to `#dashboard` → same bare placeholder, cannot navigate back to home
- User on `#dashboard` wants to log out → no logout button exists anywhere on the page
- User on `#dashboard` wants to return home → no home link/button exists, must manually edit the URL

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Home page (`#` route) continues to display the header with logo and Register button via `createHeader`
- Registration page (`#register`) continues to display "Back to Login" link without a persistent header
- Forgot-password and reset-password views continue to display with their existing navigation links
- Register button on home page header continues to navigate to `#register`
- Login form failure actions (Register, Reset Password links) continue to work

**Scope:**
All inputs that do NOT involve the `#dashboard` route (or future authenticated routes) should be completely unaffected by this fix. This includes:
- Navigation to `#`, `#register`, `#forgot-password`, `#reset-password`
- All existing UI interactions on unauthenticated pages
- The `createHeader` component's public API and rendering behavior

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Missing Header in Dashboard Handler**: The `createDashboardPlaceholder` function in `main.ts` creates only a heading and paragraph without calling any header component. Unlike `createHomeView` which explicitly calls `createHeader`, the dashboard handler omits header creation entirely.

2. **No Authenticated Header Variant**: The existing `createHeader` component only accepts `onRegisterClick` — there is no variant that renders logout and home buttons for authenticated users. Even if the dashboard included the existing header, it would show a Register button instead of logout/home controls.

3. **No Shared Layout Pattern**: Each view (HomeView, RegistrationView, etc.) manages its own header/navigation independently. There is no shared layout or wrapper that automatically provides consistent navigation across routes. The dashboard was added as a minimal placeholder without following the pattern HomeView uses.

4. **No Session Management in UI**: The application has `AuthService.ts` for API calls but no client-side session state tracking that the UI could use to determine which header variant to show.

## Correctness Properties

Property 1: Bug Condition - Dashboard Displays Authenticated Header

_For any_ navigation to the `#dashboard` route after successful login, the rendered DOM SHALL contain a header element with the ChikuMiku LearnVerse logo, a home button/link navigating to `#`, and a logout button that ends the session and navigates to the home page.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Unauthenticated Pages Unchanged

_For any_ navigation to unauthenticated routes (`#`, `#register`, `#forgot-password`, `#reset-password`), the rendered DOM SHALL produce exactly the same output as the original code, preserving the existing header with Register button on the home page, "Back to Login" links on registration/password pages, and all existing navigation behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/platform-web/app/src/components/Header.ts`

**Function**: `createHeader`

**Specific Changes**:
1. **Add AuthenticatedHeaderOptions interface**: Define an options interface with `onLogoutClick` and `onHomeClick` callbacks for the authenticated header variant.

2. **Create `createAuthenticatedHeader` function**: A new export function that renders a header with logo (left), and home + logout buttons (right). Reuses `createHeaderLogo` for consistent branding.

**File**: `packages/platform-web/app/src/main.ts`

**Function**: `createDashboardPlaceholder`

**Specific Changes**:
3. **Import `createAuthenticatedHeader`**: Import the new authenticated header component.

4. **Add header to dashboard view**: Modify `createDashboardPlaceholder` to include the authenticated header at the top of the dashboard container, with:
   - `onHomeClick` navigating to `window.location.hash = '#'`
   - `onLogoutClick` clearing any session state and navigating to `window.location.hash = '#'`

5. **Restructure dashboard layout**: Wrap the existing dashboard content in a container that sits below the header, maintaining the dashboard heading and paragraph content.

**File**: `packages/platform-web/app/src/styles/home.css`

**Specific Changes**:
6. **Add authenticated header styles**: Add CSS for `.authenticated-header` (flex layout matching `.home-header`), `.logout-btn` and `.home-btn` button styles matching the existing button design system.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the dashboard view and assert the presence of header elements, logout button, and home button. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Header Presence Test**: Render `createDashboardPlaceholder()` and assert a `<header>` element exists (will fail on unfixed code)
2. **Logo Presence Test**: Render dashboard and assert the header-logo element with img or fallback text exists (will fail on unfixed code)
3. **Logout Button Test**: Render dashboard and assert a button with "Logout" text exists (will fail on unfixed code)
4. **Home Button Test**: Render dashboard and assert a button/link with "Home" text or navigation to `#` exists (will fail on unfixed code)

**Expected Counterexamples**:
- `createDashboardPlaceholder()` returns DOM without any `<header>` element
- No element with logout or home functionality exists in the rendered output
- Possible causes: dashboard handler is a minimal placeholder that never included header creation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := createDashboardView_fixed()
  ASSERT result.querySelector('header') IS NOT NULL
  ASSERT result.querySelector('.header-logo') IS NOT NULL
  ASSERT result.querySelector('.logout-btn') IS NOT NULL
  ASSERT result.querySelector('.home-btn') IS NOT NULL
  ASSERT clickLogoutBtn(result) NAVIGATES_TO '#'
  ASSERT clickHomeBtn(result) NAVIGATES_TO '#'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT createHomeView_original() = createHomeView_fixed()
  ASSERT createRegistrationView_original() = createRegistrationView_fixed()
  ASSERT createForgotPasswordView_original() = createForgotPasswordView_fixed()
  ASSERT createResetPasswordView_original() = createResetPasswordView_fixed()
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for home page header, registration navigation, and password flow views, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Home Page Header Preservation**: Verify home page continues to show header with logo and Register button after fix
2. **Register Button Navigation Preservation**: Verify clicking Register on home header still navigates to `#register`
3. **Registration View Preservation**: Verify registration page still shows "Back to Login" link without persistent header
4. **Forgot/Reset Password Preservation**: Verify password flow views maintain their existing navigation links

### Unit Tests

- Test `createAuthenticatedHeader` renders header with logo, home button, and logout button
- Test logout button click invokes `onLogoutClick` callback
- Test home button click invokes `onHomeClick` callback
- Test existing `createHeader` remains unchanged (still renders Register button)
- Test dashboard view contains authenticated header after fix

### Property-Based Tests

- Generate random route navigations and verify appropriate header variant is displayed (authenticated vs unauthenticated)
- Generate random sequences of navigation events and verify home page header always shows Register button (preservation)
- Test that `createHeader` with arbitrary `onRegisterClick` callbacks continues to produce consistent DOM structure

### Integration Tests

- Test full login flow → dashboard navigation → verify header visible with correct buttons
- Test logout button on dashboard → verify session ends and user returns to home with Register header
- Test home button on dashboard → verify navigation to home page with original header
- Test that navigating from dashboard back to home shows unauthenticated header (Register button)
