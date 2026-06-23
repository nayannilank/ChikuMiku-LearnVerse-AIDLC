# Implementation Plan

## Overview

Fix the missing header and navigation controls on the `#dashboard` route after login. The dashboard currently renders a bare placeholder without the header component, logout button, or home button. This plan follows the exploratory bugfix workflow: write tests to confirm the bug, write preservation tests, implement the fix, then verify.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Dashboard Missing Header and Navigation Controls
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: rendering `createDashboardPlaceholder()` which always lacks header, logout, and home controls
  - Create test file: `packages/platform-web/app/src/components/DashboardHeader.property.test.ts`
  - Use `@vitest-environment jsdom` directive, import `fast-check`, `vitest`, and `createDashboardPlaceholder` (or inline equivalent from `main.ts`)
  - Property: For any authenticated user navigating to the dashboard route, the rendered DOM SHALL contain a `<header>` element with the ChikuMiku LearnVerse logo, a logout button, and a home button
  - Test that `createDashboardPlaceholder()` output contains `header` element (from `isBugCondition`: `headerComponentNotRendered(renderedDOM)`)
  - Test that `createDashboardPlaceholder()` output contains a button with "Logout" text (from `isBugCondition`: `logoutButtonNotPresent(renderedDOM)`)
  - Test that `createDashboardPlaceholder()` output contains a button/link with "Home" text or navigation to `#` (from `isBugCondition`: `homeButtonNotPresent(renderedDOM)`)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: `createDashboardPlaceholder` renders only heading and paragraph without header/navigation)
  - Document counterexamples found (e.g., "Dashboard renders div.dashboard-view with only h1 and p elements, no header/logout/home controls")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unauthenticated Pages Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `createHomeView()` renders header with logo and Register button on unfixed code
  - Observe: `createRegistrationView()` renders "Back to Login" link without persistent header on unfixed code
  - Observe: `createForgotPasswordView()` renders with existing navigation links on unfixed code
  - Observe: `createResetPasswordView('')` renders with existing navigation links on unfixed code
  - Create test file: `packages/platform-web/app/src/components/HeaderPreservation.property.test.ts`
  - Use `@vitest-environment jsdom` directive, import `fast-check`, `vitest`
  - Write property-based test: for all unauthenticated routes (`#`, `#register`, `#forgot-password`, `#reset-password`), the rendered DOM produces exactly the same output as the original code
  - Property 1: Home page header always contains a `<header>` with class `home-header`, a logo element, and a Register button (from Preservation Requirements 3.1)
  - Property 2: Register button click invokes the `onRegisterClick` callback (from Preservation Requirements 3.4)
  - Property 3: Registration view does NOT render a persistent `<header>` element but contains "Back to Login" link (from Preservation Requirements 3.2)
  - Property 4: Forgot/Reset password views maintain their existing navigation links unchanged (from Preservation Requirements 3.3)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for dashboard missing header and navigation controls

  - [x] 3.1 Create `createAuthenticatedHeader` component
    - Add `AuthenticatedHeaderOptions` interface in `packages/platform-web/app/src/components/Header.ts` with `onLogoutClick` and `onHomeClick` callbacks
    - Implement `createAuthenticatedHeader(options: AuthenticatedHeaderOptions): HTMLElement` function
    - Reuse `createHeaderLogo` for consistent branding (logo on left)
    - Render Home button (`.home-btn`) and Logout button (`.logout-btn`) on the right
    - Use `authenticated-header` CSS class with same flex layout as `home-header`
    - Export the new function
    - _Bug_Condition: isBugCondition(input) where input.route == "dashboard" AND input.userAuthenticated == true AND headerComponentNotRendered(renderedDOM)_
    - _Expected_Behavior: Dashboard displays header with logo, home button navigating to `#`, and logout button that ends session and navigates to home_
    - _Preservation: Existing `createHeader` function and its API remain completely unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Add authenticated header CSS styles
    - Add `.authenticated-header` class in `packages/platform-web/app/src/styles/home.css`
    - Style with flex layout matching `.home-header` (logo left, buttons right)
    - Add `.logout-btn` button styles matching existing button design system
    - Add `.home-btn` button styles matching existing button design system
    - _Requirements: 2.4_

  - [x] 3.3 Integrate authenticated header into dashboard view
    - Import `createAuthenticatedHeader` in `packages/platform-web/app/src/main.ts`
    - Modify `createDashboardPlaceholder` to include the authenticated header at the top of the container
    - Wire `onHomeClick` to navigate: `window.location.hash = '#'`
    - Wire `onLogoutClick` to clear session state and navigate: `window.location.hash = '#'`
    - Restructure dashboard layout: header at top, existing content (h1 + paragraph) below
    - _Bug_Condition: isBugCondition(input) where input.route == "dashboard" AND headerComponentNotRendered(renderedDOM)_
    - _Expected_Behavior: createDashboardView renders header with logo, home btn, logout btn; clicking logout navigates to '#'; clicking home navigates to '#'_
    - _Preservation: No changes to other route handlers (HomeView, RegistrationView, ForgotPasswordView, ResetPasswordView)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dashboard Displays Authenticated Header
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (header present, logout button present, home button present)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Unauthenticated Pages Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions to home page header, registration view, or password flow views)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx turbo test:unit test:property --filter=@learnverse/web-app`
  - Verify bug condition test (Property 1) passes - confirms fix works
  - Verify preservation tests (Property 2) pass - confirms no regressions
  - Verify existing unit tests still pass (Header.ts, HomeView, RegistrationView, ForgotPasswordView, ResetPasswordView)
  - Ensure all tests pass, ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    ["1"],
    ["2"],
    ["3.1", "3.2"],
    ["3.3"],
    ["3.4", "3.5"],
    ["4"]
  ]
}
```

- Task 1 (Bug Condition Exploration Test) must be written and run BEFORE any implementation
- Task 2 (Preservation Tests) must be written and run BEFORE any implementation
- Tasks 3.1 (Create component) and 3.2 (CSS) can proceed in parallel
- Task 3.3 (Integration) depends on both 3.1 and 3.2
- Tasks 3.4 and 3.5 (Verification) run after implementation (3.3)
- Task 4 (Checkpoint) runs after all other tasks complete

## Notes

- Tests use Vitest with `@vitest-environment jsdom` and `fast-check` for property-based testing
- The test file naming convention follows `*.property.test.ts` for property-based tests
- Run property tests with: `npx turbo test:property --filter=@learnverse/web-app`
- The `createDashboardPlaceholder` function in `main.ts` is not exported; tests may need to import from main or replicate the dashboard creation logic
- The existing `createHeader` function must remain unchanged to preserve home page behavior
