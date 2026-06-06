# Implementation Plan: Mobile App UX Improvements

## Overview

This plan implements authentication gating, textbook/chapter content hierarchy, camera-based page capture, and consistent branding across the ChikuMiku LearnVerse mobile and web applications. Tasks are organized to build foundational validation and data models first, then backend API endpoints, followed by mobile screens/navigation, content management UI, page capture, branding, and finally end-to-end wiring.

## Tasks

- [x] 1. Implement validation functions and data models
  - [x] 1.1 Create authentication field validators
    - Create `packages/services/auth/src/validation.ts` with exported functions: `validateUsername` (5-15 chars, `/^[a-zA-Z0-9_-]+$/`), `validatePassword` (8-20 chars, 1 uppercase + 1 lowercase + 1 special + 1 digit), `validateEmail` (contains `@` + domain with dot, non-empty, max 254 chars), `validatePhone` (exactly 10 digits, no other characters)
    - Each function returns `{ valid: boolean; error?: string }`
    - _Requirements: 2.1, 3.2, 3.3, 3.8, 3.9_

  - [ ]* 1.2 Write property test for username validation
    - **Property 2: Username validation**
    - Test that validator accepts if and only if input matches `/^[a-zA-Z0-9_-]{5,15}$/`
    - Use `fc.string()` and `fc.stringOf(fc.constantFrom(...validChars))` arbitraries
    - **Validates: Requirements 3.2, 3.9**

  - [ ]* 1.3 Write property test for password validation
    - **Property 3: Password validation**
    - Test that validator accepts if and only if length 8-20 and contains at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character
    - **Validates: Requirements 3.8**

  - [ ]* 1.4 Write property test for email and phone validation
    - **Property 4: Email and phone number validation**
    - Test email accepts if and only if contains `@` + domain with dot, non-empty, max 254 chars
    - Test phone accepts if and only if exactly 10 digits with no other characters
    - **Validates: Requirements 3.3**

  - [x] 1.5 Create content name validation and data models
    - Create `packages/services/core/src/textbook.ts` with `validateContentName` function accepting trimmed strings between 1-200 chars
    - Export `Textbook`, `Chapter`, `Page` TypeScript interfaces matching design data models
    - _Requirements: 4.2, 4.6_

  - [ ]* 1.6 Write property test for content name validation
    - **Property 5: Content name validation (textbook and chapter names)**
    - Test that validator accepts if and only if trimmed length is 1-200 chars inclusive
    - **Validates: Requirements 4.2, 4.6**

  - [x] 1.7 Create page management module
    - Create `packages/services/core/src/pageManagement.ts` with `addPageToChapter` function
    - Validate image format (JPEG/PNG) and size (≤ 10,485,760 bytes)
    - Return updated chapter pages array on success; return unchanged array on failure
    - _Requirements: 5.5, 5.11, 5.12, 5.14_

  - [ ]* 1.8 Write property test for accepting valid image adds one page
    - **Property 10: Accepting a valid image adds exactly one page**
    - Test that for valid images (JPEG/PNG, ≤ 10 MB), chapter pages length increases by exactly one and new page references the accepted image
    - **Validates: Requirements 5.5**

  - [ ]* 1.9 Write property test for invalid image operations
    - **Property 11: Invalid image operations do not modify chapter pages**
    - Test that for failed uploads or files exceeding 10 MB, chapter pages remain unchanged (same length and contents)
    - **Validates: Requirements 5.12, 5.14**

  - [ ]* 1.10 Write property test for file size gate
    - **Property 13: File size gate for image selection**
    - Test that files ≤ 10 MB with valid format produce preview; files > 10 MB are rejected with error
    - **Validates: Requirements 5.11, 5.14**

- [x] 2. Implement backend API endpoints for auth and content
  - [x] 2.1 Create authentication API endpoints
    - Create `packages/services/api/src/authHandlers.ts` with handlers for POST `/api/v1/auth/login`, POST `/api/v1/auth/register/parent`, POST `/api/v1/auth/register/student`, POST `/api/v1/auth/forgot-password`, GET `/api/v1/auth/validate`
    - Integrate with `@chikumiku/service-auth` for JWT issuance (30-day minimum expiry) and lockout logic (3 failures → 15-minute lock)
    - Register routes in `packages/services/api/src/endpoints.ts`
    - _Requirements: 1.1, 2.2, 2.3, 2.5, 3.4, 3.10, 3.11_

  - [x] 2.2 Create registration logic with parent-student linking
    - Create `packages/services/auth/src/registration.ts` with `registerParent` and `registerStudent` functions
    - `registerParent`: validate all fields, check for duplicate username/email/phone, create `ParentAccount`
    - `registerStudent`: validate fields, verify parent username exists, link student to parent, create `StudentAccount`
    - Return field-specific errors for each invalid field while preserving valid values
    - _Requirements: 3.1, 3.6, 3.7, 3.10, 3.12, 3.14_

  - [ ]* 2.3 Write property test for registration validation field-specific errors
    - **Property 8: Registration validation produces field-specific errors**
    - Test that when at least one field fails validation, result contains error entry for each invalid field while preserving valid field values
    - **Validates: Requirements 3.6, 3.14**

  - [x] 2.4 Create textbook and chapter API endpoints
    - Create `packages/services/api/src/contentHandlers.ts` with handlers for GET/POST `/api/v1/subjects/:subjectId/textbooks`, GET/POST `/api/v1/textbooks/:textbookId/chapters`, POST `/api/v1/chapters/:chapterId/pages`
    - Use content name validation from `packages/services/core/src/textbook.ts`
    - Register routes in `packages/services/api/src/endpoints.ts`
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.7, 4.9_

- [x] 3. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement mobile authentication screens and navigation
  - [x] 4.1 Create AuthContext and useAuth hook
    - Create `packages/platform-mobile/rn-app/src/context/AuthContext.tsx` providing token state, login, register, logout functions
    - Create `packages/platform-mobile/rn-app/src/hooks/useAuth.ts` exposing `isAuthenticated`, `login`, `registerParent`, `registerStudent`, `logout`
    - Store/retrieve session token via `DeviceStorageInterface`
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3_

  - [x] 4.2 Create route resolver and update RootNavigator
    - Create `packages/platform-mobile/rn-app/src/navigation/routeResolver.ts` with `resolveInitialRoute` function returning `'Auth'` or `'Main'` based on token state
    - Update `packages/platform-mobile/rn-app/App.tsx` to use conditional navigation: Splash → Auth stack or Main stack
    - Define `RootStackParamList`, `AuthStackParamList`, `MainStackParamList` types
    - _Requirements: 1.1, 1.2, 1.5, 2.3_

  - [ ]* 4.3 Write property test for invalid auth state routes to auth screen
    - **Property 1: Invalid auth state routes to auth screen**
    - Test that for any missing, expired, or invalid token state (including network validation failure), `resolveInitialRoute` returns auth screen route
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 4.4 Write property test for successful auth routes to main screen
    - **Property 6: Successful authentication routes to main screen**
    - Test that for any successful auth result (login or student auto-login), navigator resolves to subject selection screen
    - **Validates: Requirements 2.3, 3.11**

  - [x] 4.5 Implement SplashScreen with timeout clamping
    - Create `packages/platform-mobile/rn-app/src/screens/SplashScreen.tsx`
    - Display `ChikuMiku-LearnVerse-Logo.png` centered on white background
    - Validate stored token; clamp visibility to min 1s, max 5s using `max(1, min(d, 5))` logic
    - On timeout or initialization failure, transition to Auth screen with error message
    - _Requirements: 6.1, 6.2, 6.5_

  - [ ]* 4.6 Write property test for splash screen duration clamping
    - **Property 12: Splash screen duration is clamped between 1 and 5 seconds**
    - Test that for any initialization duration `d`, splash visibility equals `max(1, min(d, 5))`
    - **Validates: Requirements 6.2**

  - [x] 4.7 Implement LoginScreen
    - Create `packages/platform-mobile/rn-app/src/screens/LoginScreen.tsx`
    - Username input (5-15 chars), password input (masked, max 20 chars), submit button, "Forgot Password" link
    - On submit: disable button, authenticate within 30s timeout, store token on success
    - On error: preserve username, clear password, display error message, re-enable submit
    - On lockout: display 15-minute notification, disable submit until lockout expires
    - On no network: display "Network connection required", preserve all fields
    - Toggle between login and registration modes; login is default
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 1.4_

  - [ ]* 4.8 Write property test for login error preserves username
    - **Property 7: Login error preserves username and clears password**
    - Test that for any login error (invalid credentials, lockout, server error), form state preserves username, clears password to empty string, and contains non-empty error message
    - **Validates: Requirements 2.4**

  - [x] 4.9 Implement ParentRegistrationScreen
    - Create `packages/platform-mobile/rn-app/src/screens/ParentRegistrationScreen.tsx`
    - Fields: name (max 100), username (5-15 chars, alphanumeric + underscores + hyphens), phone (10 digits), email (max 254 chars)
    - On submit: disable button, show loading indicator, send to Auth_Service
    - On success: show confirmation and prompt to register student
    - On error: display field-specific errors for duplicate fields, preserve other valid fields
    - On network timeout (30s): show connectivity error, re-enable submit, preserve fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.13, 3.14_

  - [x] 4.10 Implement StudentRegistrationScreen
    - Create `packages/platform-mobile/rn-app/src/screens/StudentRegistrationScreen.tsx`
    - Fields: name (max 100), username (5-15), password (8-20 with complexity rules), grade (1-12 picker), parent username (5-15)
    - On success: auto-login student and navigate to subject selection
    - Handle parent-not-found error and field-specific validation errors
    - On network timeout (30s): show connectivity error, re-enable submit, preserve fields
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

- [x] 5. Checkpoint - Ensure all auth flow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement textbook and chapter screens
  - [x] 6.1 Implement TextbookListScreen
    - Create `packages/platform-mobile/rn-app/src/screens/TextbookListScreen.tsx`
    - Display list of textbooks for selected subject; "Add Textbook" button
    - If no textbooks exist for the subject, display Textbook_Entry_Form immediately
    - Navigate to ChapterSelection on textbook tap
    - _Requirements: 4.1, 4.4_

  - [x] 6.2 Implement TextbookEntryForm component
    - Create `packages/platform-mobile/rn-app/src/components/TextbookEntryForm.tsx`
    - Input field with 200-char max, inline validation error for empty/too-long names
    - On submit: call POST `/api/v1/subjects/:subjectId/textbooks`; on error preserve values and show error
    - Cancel button returns to previous screen without creating
    - _Requirements: 4.2, 4.3, 4.8, 4.9, 4.10_

  - [ ]* 6.3 Write property test for form preservation on error
    - **Property 9: Form preservation on backend or validation error**
    - Test that for any form submission resulting in backend error or validation failure, all field values are preserved and form remains visible (not dismissed)
    - **Validates: Requirements 4.9, 4.10**

  - [x] 6.4 Implement ChapterCreationForm component
    - Create `packages/platform-mobile/rn-app/src/components/ChapterCreationForm.tsx`
    - Input field with 200-char max, inline validation
    - On submit: call POST `/api/v1/textbooks/:textbookId/chapters`; navigate to Learning screen on success
    - Cancel returns to chapter list without creating
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 6.5 Update ChapterSelectionScreen for textbook hierarchy
    - Modify `packages/platform-mobile/rn-app/src/screens/ChapterSelectionScreen.tsx`
    - Accept `textbookId` from navigation params; display chapters for selected textbook
    - Add "Add Chapter" button that opens ChapterCreationForm
    - _Requirements: 4.5, 4.7_

- [x] 7. Implement page addition UI (camera and gallery)
  - [x] 7.1 Implement PageAdditionUI component
    - Create `packages/platform-mobile/rn-app/src/components/PageAdditionUI.tsx`
    - Camera capture button (hidden if camera unavailable on device) + gallery upload button
    - Request camera permission on camera tap; request storage/photo library permission on gallery tap
    - On permission denied: display message with guidance to enable in device settings
    - Validate file size (≤ 10 MB) and format (JPEG/PNG) before showing preview
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.9, 5.10, 5.14, 5.15_

  - [x] 7.2 Implement ImagePreview component
    - Create `packages/platform-mobile/rn-app/src/components/ImagePreview.tsx`
    - Display captured/selected image with "Accept" and "Retake/Choose Another" buttons
    - On accept: call POST `/api/v1/chapters/:chapterId/pages` to upload
    - On upload failure: remove local page association, show error message, return to Learning screen without the failed page
    - On cancel from file picker: remain on Learning screen without changes
    - _Requirements: 5.4, 5.5, 5.8, 5.11, 5.12, 5.13_

  - [x] 7.3 Integrate PageAdditionUI into LearningScreen
    - Modify `packages/platform-mobile/rn-app/src/screens/LearningScreen.tsx`
    - Display PageAdditionUI when a chapter is active
    - Wire camera via `CameraInterface` and gallery via `FileSystemInterface` from `@chikumiku/platform-contracts`
    - Open camera in JPEG format; open file picker filtered to JPEG and PNG
    - _Requirements: 5.1, 5.3, 5.5_

- [x] 8. Implement branding (mobile and web)
  - [x] 8.1 Add mobile branding components
    - Create `packages/platform-mobile/rn-app/src/components/HeaderLogo.tsx` displaying logo scaled to nav bar height without cropping
    - Update App.tsx `screenOptions` to include HeaderLogo in navigation bar header
    - Configure Android app icon using `ChikuMiku-LearnVerse-Logo.png` in `rn-app/android/app/src/main/res/` (generate mipmap resources)
    - _Requirements: 6.3, 6.4_

  - [x] 8.2 Add web branding components
    - Create `packages/platform-web/app/src/components/HeaderLogo.tsx` displaying logo in header/navigation area, scaled proportionally without cropping
    - Generate favicon from `ChikuMiku-LearnVerse-Logo.png` to `packages/platform-web/app/public/favicon.ico`
    - Display logo on login page and all authenticated pages within the navigation area
    - Implement text fallback "ChikuMiku LearnVerse" on image load error
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. Wire navigation and integration
  - [x] 9.1 Wire complete navigation flow end-to-end
    - Connect Auth stack (Login, ParentRegistration, StudentRegistration, ForgotPassword) to RootNavigator
    - Connect Main stack (SubjectSelection → TextbookList → ChapterSelection → Learning)
    - Handle session expiry mid-session: redirect to Auth with "Session ended" message
    - Attempt to preserve unsaved learner input in device storage on redirect; if storage fails, display error and let user choose to proceed without saving
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.3, 3.11_

  - [x] 9.2 Wire mobile API client for auth and content endpoints
    - Update `packages/platform-mobile/rn-app/src/api/learningApi.ts` to include auth endpoints (login, register, validate, forgot-password) and content endpoints (textbooks, chapters, pages)
    - Use session token from AuthContext for Bearer auth header on protected endpoints
    - Replace hardcoded `LEARNER_ID` with authenticated user ID from token
    - _Requirements: 2.2, 4.3, 4.7, 5.5, 5.12_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` + Vitest
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementations use TypeScript
- Validation logic is shared between backend (`packages/services/`) and referenced by mobile screens for client-side pre-validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5", "1.7"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.6", "1.8", "1.9", "1.10", "2.1", "2.2", "2.4"] },
    { "id": 2, "tasks": ["2.3", "4.1", "4.2", "4.5", "8.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.6", "4.7", "4.9", "4.10", "8.1"] },
    { "id": 4, "tasks": ["4.8", "6.1", "6.2", "6.4", "6.5"] },
    { "id": 5, "tasks": ["6.3", "7.1", "7.2"] },
    { "id": 6, "tasks": ["7.3", "9.1", "9.2"] }
  ]
}
```
