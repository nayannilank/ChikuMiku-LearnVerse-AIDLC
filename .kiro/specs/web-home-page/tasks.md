# Implementation Plan: Web Home Page

## Overview

Transform the existing minimal sign-in page into a fully branded LearnVerse home page with a header (logo + register button), centered login form with validation and error handling, forgot-password link, and background watermark. Implementation uses the existing factory-function component pattern (vanilla TypeScript + DOM manipulation) with an external CSS stylesheet.

## Tasks

- [x] 1. Create CSS stylesheet and utility module
  - [x] 1.1 Create `src/styles/home.css` stylesheet
    - Define CSS variables for colors, spacing, shadows, and border radii
    - Style the header (flex layout, logo left, register button right)
    - Style the background watermark (fixed position, centered, z-index -1, opacity 0.05, pointer-events none, min-width 50vw)
    - Style the login card (centered, rounded corners, shadow, max-width 400px)
    - Style form inputs, labels, submit button, error messages, and forgot-password link
    - Add responsive media query for viewport <= 768px (card expands to full width minus padding)
    - Style the register button with contrasting/outlined appearance
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 3.3, 4.1, 4.5, 5.3, 7.1, 7.2, 7.3_

  - [x] 1.2 Extract `escapeHtml` into a shared utility module `src/utils/escapeHtml.ts`
    - Move the existing `escapeHtml` function from `main.ts` into its own module
    - Export it for use across components and tests
    - _Requirements: 5.2, 5.4_

- [x] 2. Implement UI components
  - [x] 2.1 Implement `createHeader` component in `src/components/Header.ts`
    - Factory function accepting `HeaderOptions` with `onRegisterClick` callback
    - Renders flex container with `createHeaderLogo({ logoSrc: '/ChikuMiku-LearnVerse-Logo.png', maxHeight: 40 })` on the left
    - Renders a styled register button on the right that invokes `onRegisterClick`
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_

  - [x] 2.2 Implement `createBackgroundWatermark` component in `src/components/BackgroundWatermark.ts`
    - Factory function returning an HTMLElement
    - Renders logo image at 50%+ viewport width with opacity 0.05, fixed position, centered, z-index -1, pointer-events none
    - On image load error, hide element silently (decorative only)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Implement `createLoginCard` component in `src/components/LoginCard.ts`
    - Factory function accepting `LoginCardOptions` with `onForgotPassword` callback and `onSubmit` async handler
    - Renders card container with username input (with label, matching for/id), password input (with label, matching for/id, masked), and submit button labeled "Log In"
    - Renders forgot-password link below the form that calls `onForgotPassword`
    - Implements client-side validation: empty field check with inline error and `aria-describedby`
    - Manages form submission state: disables button, shows loading text, re-enables on failure
    - Displays error messages from `onSubmit` rejection using `escapeHtml`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3_

- [x] 3. Implement AuthService
  - [x] 3.1 Create `src/services/AuthService.ts`
    - Implement `loginUser(username, password): Promise<LoginResult>` function
    - POST to `${API_BASE}/api/v1/auth/login` with JSON body
    - Return `{ success: true }` on 2xx response
    - Return `{ success: false, error: message }` on 4xx/5xx, extracting message from `response.message || response.error || fallback`
    - Return `{ success: false, error: networkMessage }` on fetch failure ("Unable to connect. Please check your internet connection.")
    - Export `API_BASE` constant configured via environment variable (defaults to `http://localhost:3000` in dev)
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 4. Checkpoint - Verify components build
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Wire components together in main.ts
  - [x] 5.1 Refactor `src/main.ts` to compose the home page
    - Import the external CSS stylesheet (`import './styles/home.css'`)
    - Import and use `createHeader`, `createBackgroundWatermark`, `createLoginCard`, and `loginUser`
    - Remove the old inline `renderLoginForm`, `handleLogin`, `renderWelcome`, `showMessage`, and `escapeHtml` functions
    - Wire `onRegisterClick` to navigate to registration view (hash-based routing)
    - Wire `onForgotPassword` to navigate to forgot-password view
    - Wire `onSubmit` to call `loginUser` and handle success/failure
    - Ensure the logo file `ChikuMiku-LearnVerse-Logo.png` is served from the public directory (copy or reference)
    - _Requirements: 1.1, 3.2, 5.1, 6.2, 8.2_

- [x] 6. Write tests
  - [x]* 6.1 Write unit tests in `src/components/HomePage.test.ts`
    - Test header renders logo with correct src, alt, maxHeight and register button is clickable
    - Test background watermark has correct opacity, pointer-events, and min-width styles
    - Test login card structure: inputs with labels (matching for/id), submit button labeled "Log In", card styles
    - Test form submission: loading state (button disabled, text change), error display, success state
    - Test network error handling displays appropriate message
    - Test accessibility: `aria-describedby` linked on validation error, all inputs have labels
    - Test responsive: max-width style applied on card
    - Test forgot-password link present and triggers callback
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4, 6.1, 7.2, 8.1, 8.3_

  - [x]* 6.2 Write property test for error message extraction in `src/components/HomePage.property.test.ts`
    - **Property 1: Error message extraction preserves API response content**
    - For any API error response object containing `message` or `error` field with a non-empty string, the login error handler extracts and displays that exact string value (after HTML escaping)
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 5.2**

  - [x]* 6.3 Write property test for HTML escaping round-trip in `src/components/HomePage.property.test.ts`
    - **Property 2: HTML escaping round-trip preserves text content**
    - For any arbitrary string, `escapeHtml(input)` inserted as innerHTML and read back as textContent equals the original input
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 5.2, 5.4**

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `HeaderLogo.ts` component is reused directly — no modifications needed
- The `escapeHtml` utility is extracted for reuse across `LoginCard` and `AuthService` error handling

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] }
  ]
}
```
