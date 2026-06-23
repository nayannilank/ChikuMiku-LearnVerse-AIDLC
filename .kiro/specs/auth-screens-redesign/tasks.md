# Implementation Plan: Auth Screens Redesign

## Overview

Rebuild the Login and Parent Registration screens to match the ChikuMiku LearnVerse design mockups. Implementation introduces design tokens, new components (TopNavBar, BrandingPanel, RoleTabs, LoginPanel, PasswordStrengthIndicator), a new LoginView with two-panel layout, and a refactored ParentRegistrationView. All work is in `packages/platform-web/app/src/`.

## Tasks

- [x] 1. Create design tokens and foundational styles
  - [x] 1.1 Create `src/styles/design-tokens.css` with all design system tokens
    - Define CSS custom properties for colors (#E94F9B, #9B59B6, #F8F5FF, #2C2341, #E0D8EC, #E74C3C, #27AE60, #FFFFFF, #6B7280)
    - Define typography tokens (title 26px, heading 16-18px, body 13px, button 11-13px, label 10-11px)
    - Define spacing/radius tokens (card 16px, button 22px, input 8px), shadow, navbar height 36px, watermark settings
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 1.2 Create `src/styles/login-view.css` with two-panel layout and responsive styles
    - Define `.login-view` with background #F8F5FF and flex row layout
    - Define `.branding-panel` and `.login-panel` side-by-side layout
    - Define responsive breakpoint at 768px to stack vertically
    - Define `.login-card` with 16px radius and card shadow
    - Define watermark positioning (75% width, 5% opacity, centered, pointer-events: none)
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4_

  - [x] 1.3 Create `src/styles/registration-view.css` with updated registration form styles
    - Define card container with 16px radius and card shadow
    - Define form field styles using design tokens (8px input radius, #E0D8EC borders)
    - Define pill-shaped submit button styles (#E94F9B, 22px radius)
    - Define password strength indicator styles (green checkmarks #27AE60)
    - _Requirements: 5.4, 5.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 8.1_

- [x] 2. Implement TopNavBar component
  - [x] 2.1 Create `src/components/TopNavBar.ts`
    - Export `createTopNavBar(options: TopNavBarOptions): HTMLElement`
    - Render `<nav>` at 36px height with background #2C2341
    - Add logo on left (max-height 36px, alt="ChikuMiku LearnVerse")
    - Add navigation links: Dashboard, Subjects, Revision, Progress (11-13px SemiBold white)
    - Add circular avatar with letter "A" on right
    - Implement keyboard navigation (Tab/Shift+Tab) for all links
    - Implement hover/focus indicators (underline or background change)
    - Call `onNavigate` with hash route on click/Enter
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 2.2 Write unit tests for TopNavBar
    - Test correct DOM structure (logo, four nav links in order, avatar)
    - Test alt text on logo image
    - Test CSS classes and aria attributes
    - Test `onNavigate` callback on link activation
    - Test keyboard focus order
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

- [x] 3. Implement BrandingPanel component
  - [x] 3.1 Create `src/components/BrandingPanel.ts`
    - Export `createBrandingPanel(): HTMLElement`
    - Render title "ChikuMiku LearnVerse" at 26px Bold #2C2341
    - Render subtitle "Where Curiosity Comes Alive ✨"
    - Render three stat badges: "7+ Subjects", "LKG-12 Grades", "AI Powered"
    - Render logo watermark (75% width, 5% opacity, centered, pointer-events: none)
    - Handle watermark image error by hiding the container
    - _Requirements: 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.2 Write unit tests for BrandingPanel
    - Test title text, subtitle text, three stat badges present
    - Test watermark element has pointer-events: none and opacity styling
    - Test watermark hides on image error event
    - _Requirements: 2.3, 2.4, 2.5, 4.5_

- [x] 4. Implement RoleTabs component
  - [x] 4.1 Create `src/components/RoleTabs.ts`
    - Export `createRoleTabs(options: RoleTabsOptions): HTMLElement`
    - Render two pill-shaped tab buttons: "Parent" | "Learner"
    - Active tab: background #E94F9B, text #FFFFFF
    - Inactive tab: transparent background, text #2C2341
    - Border-radius 20-22px
    - Default to "Parent" active on load
    - Apply ARIA: `role="tablist"`, each tab `role="tab"` + `aria-selected`
    - Call `onRoleSelected` callback with `'parent'` or `'student'` on tab click
    - _Requirements: 3.3, 3.4, 3.5, 3.10_

  - [x] 4.2 Write property test for Role Tab Mutual Exclusivity
    - **Property 1: Role Tab Mutual Exclusivity**
    - **Validates: Requirements 3.4, 3.5**
    - Use `fc.array(fc.constantFrom('parent', 'student'), { minLength: 1, maxLength: 50 })` to generate selection sequences
    - Assert exactly one tab has active CSS class after each selection in sequence

  - [x] 4.3 Write unit tests for RoleTabs
    - Test default "Parent" active state on creation
    - Test clicking "Learner" switches active state
    - Test ARIA attributes (tablist, tab, aria-selected)
    - Test onRoleSelected callback fires with correct role
    - _Requirements: 3.3, 3.4, 3.5, 3.10_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement PasswordStrengthIndicator component
  - [x] 6.1 Create `src/components/PasswordStrengthIndicator.ts`
    - Export `evaluatePasswordStrength(password: string): PasswordCriteria`
    - Export `createPasswordStrengthIndicator(): { element: HTMLElement; update: (password: string) => void }`
    - Implement criteria evaluation: uppercase (/[A-Z]/), lowercase (/[a-z]/), number (/[0-9]/), symbol (/[^a-zA-Z0-9]/), minLength (≥8)
    - Render five criteria labels: "Uppercase", "Lowercase", "Number", "Symbol", "8+ chars"
    - Show green checkmark (#27AE60) when criterion met, neutral/gray when not
    - `update(password)` re-evaluates and updates DOM
    - Show indicator when password field has content, hide when empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Write property test for Password Strength Evaluation Correctness
    - **Property 2: Password Strength Evaluation Correctness**
    - **Validates: Requirements 7.3, 7.4**
    - Use `fc.string({ minLength: 0, maxLength: 30 })` to generate arbitrary passwords
    - Assert each criterion in `evaluatePasswordStrength(s)` matches the corresponding regex test on `s`

  - [x] 6.3 Write property test for Password Indicator Visibility
    - **Property 3: Password Strength Indicator Visibility**
    - **Validates: Requirements 7.1**
    - Use `fc.string({ minLength: 0, maxLength: 30 })` to generate strings
    - Assert non-empty string → indicator visible (display !== 'none'), empty string → indicator hidden

  - [x] 6.4 Write unit tests for PasswordStrengthIndicator
    - Test five criteria labels render correctly
    - Test evaluatePasswordStrength returns correct results for known inputs
    - Test green checkmark displays for satisfied criteria
    - Test visibility toggle based on input content
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Implement LoginPanel component
  - [x] 7.1 Create `src/components/LoginPanel.ts`
    - Export `createLoginPanel(options: LoginPanelOptions): HTMLElement`
    - Render heading "Welcome Back!" (16-18px Bold #2C2341)
    - Render subtitle "Log in to continue learning" (12-14px Regular #6B7280)
    - Embed RoleTabs (default: Parent)
    - Render Username and Password fields (label 10-11px SemiBold, input border-radius 8px, border #E0D8EC)
    - Render pill-shaped Login button (full-width, #E94F9B, 11-13px SemiBold, 22px radius)
    - Render "Forgot Password?" link (10-12px #E94F9B, center-aligned)
    - Wire card wrapper with 16px radius and box-shadow
    - Reuse existing `validateLoginUsername` and `validateLoginPassword` from LoginForm.ts
    - Handle loading state (disable button, "Signing in..." text)
    - Handle error display (#E74C3C styled container)
    - _Requirements: 2.6, 3.1, 3.2, 3.6, 3.7, 3.8, 3.9_

  - [x] 7.2 Write unit tests for LoginPanel
    - Test heading, subtitle, RoleTabs presence
    - Test input labels and placeholders
    - Test button text and styling classes
    - Test forgot-password link text and color
    - Test loading state toggles button text
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8, 3.9_

- [x] 8. Implement LoginView
  - [x] 8.1 Create `src/views/LoginView.ts`
    - Export `createLoginView(): HTMLElement`
    - Compose TopNavBar at top
    - Compose two-panel layout: BrandingPanel (left) + LoginPanel (right)
    - Set page background #F8F5FF
    - Wire login submission to existing `loginWithRole` from AuthService
    - Wire forgot password to hash navigation (#forgot-password)
    - Wire successful login to hash navigation (#dashboard)
    - _Requirements: 1.9, 2.1, 2.2, 2.7, 3.10_

  - [x] 8.2 Update `src/router/HashRouter.ts` to route `#login` and empty hash to LoginView
    - Import and register `createLoginView` for `#login` and default (empty hash) routes
    - Keep existing `HomeView` route for authenticated-only access if needed
    - _Requirements: 2.1_

  - [x] 8.3 Write unit tests for LoginView
    - Test two-panel structure (branding + login siblings)
    - Test TopNavBar is present
    - Test background class applied
    - _Requirements: 2.1, 2.2, 1.9_

- [x] 9. Refactor ParentRegistrationView
  - [x] 9.1 Refactor `src/views/ParentRegistrationView.ts`
    - Compose TopNavBar at top (same shared component)
    - Render heading "Create Parent Account" (16-18px Bold #2C2341)
    - Render subtitle "Register first, then add your children"
    - Render form card with 16px radius and card shadow
    - Restyle all form fields with design tokens (8px input radius, #E0D8EC borders, 10-11px SemiBold labels)
    - Add PasswordStrengthIndicator below the password field
    - Wire indicator `update()` to password input events
    - Render pill-shaped "Register Parent" button (#E94F9B, 22px radius)
    - Handle loading state ("Registering..." text, disabled button)
    - Handle inline validation errors in #E74C3C
    - Set page background #F8F5FF
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.5, 8.1, 8.2, 8.3_

  - [x] 9.2 Write unit tests for ParentRegistrationView
    - Test TopNavBar is present
    - Test heading and subtitle text
    - Test form fields with correct placeholders
    - Test PasswordStrengthIndicator is rendered below password field
    - Test submit button text and styling
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx turbo build --filter=@learnverse/web-app` to verify build passes
  - Run `npx turbo test:unit test:property --filter=@learnverse/web-app` to verify all tests pass

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all components follow the existing vanilla TS pattern (no framework)
- Build command: `npx turbo build --filter=@learnverse/web-app`
- Test commands: `npx turbo test:unit test:property --filter=@learnverse/web-app`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "4.3", "6.2", "6.3", "6.4"] },
    { "id": 3, "tasks": ["7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1", "9.1"] },
    { "id": 5, "tasks": ["8.2"] },
    { "id": 6, "tasks": ["8.3", "9.2"] }
  ]
}
```
