# Implementation Plan: End-to-End UI Integration

## Overview

This plan wires all existing React screen components into the ChikuMiku LearnVerse hash router. The work creates a React-to-DOM bridge utility, shared loading/error components, an async route container, and 14 route registrations in `main.ts`. The existing screens in `packages/platform-web/app/src/screens/` are already built — this is purely integration plumbing.

## Tasks

- [x] 1. Create foundation utilities and shared components
  - [x] 1.1 Implement the React Bridge utility (`utils/reactBridge.ts`)
    - Create `renderReactRoute(element: ReactElement): HTMLElement` function
    - Implement `createRoot` mounting with `MutationObserver`-based unmount detection
    - Track `currentMount` state and implement `cleanupCurrentMount()`
    - Export the utility for use by route handlers
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Implement the shared LoadingView component (`components/LoadingView.ts`)
    - Create `createLoadingView(message?: string): HTMLElement` factory
    - Apply design-system tokens: background `#F8F5FF`, border `#E0D8EC`, spinner accent `#E94F9B`
    - Set `role="status"` and `aria-live="polite"` for accessibility
    - _Requirements: 14.1, 14.4_

  - [x] 1.3 Implement the shared ErrorView component (`components/ErrorView.ts`)
    - Create `createErrorView(message?: string, onRetry?: () => void): HTMLElement` factory
    - Include error icon, message text, and conditional "Retry" button
    - Apply design-system tokens: error red `#E74C3C`, background `#F8F5FF`, border `#E0D8EC`
    - Set `role="alert"` for accessibility
    - _Requirements: 14.2, 14.4_

  - [x] 1.4 Implement the Async Route Container (`utils/asyncRoute.ts`)
    - Create `createAsyncRouteContainer(activeRoute, factory, options?)` function
    - Implement loading → fetch → mount lifecycle with `renderReactRoute`
    - Handle 401 errors (clear tokens, redirect to `#login`)
    - Handle network/5xx errors (show ErrorView with retry button)
    - Wire `wrapInResponsiveLayout` around all states
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 2. Checkpoint — Verify foundation compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Register content ingestion routes
  - [x] 3.1 Register `#scan` / `#ingest` route for ContentIngestionScreen
    - Pattern: `/^(scan|ingest)$/`
    - Fetch subjects via `contentApi.getSubjects()` in async factory
    - Pass subjects, `fetchBooks`, `createBook`, `fetchChapters`, `createChapter`, `onChapterSelect` (navigates to `#upload/{chapterId}`)
    - Replace existing placeholder `#scan` route
    - _Requirements: 2.1, 2.4_

  - [x] 3.2 Register `#upload/{chapterId}` route for PageUploadUI
    - Pattern: `/^upload\/(?<chapterId>[^/]+)$/`
    - Extract `chapterId` from named capture group
    - Pass `chapterId`, `onExtractText` (wraps `ingestionApi.uploadPages` + `ingestionApi.extractText`)
    - On extraction complete, navigate to `#transcript/{chapterId}`
    - _Requirements: 2.2, 2.5_

  - [x] 3.3 Register `#transcript/{chapterId}` route for ChapterTranscript
    - Pattern: `/^transcript\/(?<chapterId>[^/]+)$/`
    - Extract `chapterId`, fetch transcript via `ingestionApi.getTranscript(chapterId)`
    - Pass `pages`, `onSaveTranscript`, and "Continue to Explanation" navigation link to `#explain/{chapterId}`
    - _Requirements: 2.3, 2.6, 15.1_

- [x] 4. Register explanation and exercise routes
  - [x] 4.1 Register `#explain/{chapterId}` route for ChapterExplanationScreen
    - Pattern: `/^explain\/(?<chapterId>[^/]+)$/`
    - Extract `chapterId`, pass API methods: `fetchExplanation`, `generateAudio`, `generateRevisionQuestions`, `fetchRevisionQuestions`, `generateSummary`, `fetchSummary`, `translateExplanation`
    - Add "Back to Transcript" link → `#transcript/{chapterId}` and "Exercise Help" link → `#exercises/{chapterId}`
    - On revision questions generated, navigate to `#revision/{chapterId}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 15.2_

  - [x] 4.2 Register `#exercises/{chapterId}` route for ExerciseAssistant
    - Pattern: `/^exercises\/(?<chapterId>[^/]+)$/`
    - Extract `chapterId`, fetch exercises via `contentApi.getExercises({ chapterId })`
    - Pass `chapterId`, `exercises`, `fetchHint`, `evaluateAnswer`
    - _Requirements: 4.1, 4.2_

- [x] 5. Register subject-specific exercise routes
  - [x] 5.1 Register `#pronunciation/{subjectId}` route for PronunciationScreen
    - Pattern: `/^pronunciation\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, fetch first word via pronunciation API
    - Pass `word`, `fetchReferenceAudio`, `submitRecording`, `onNext`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Register `#grammar/{subjectId}` route for GrammarExerciseScreen
    - Pattern: `/^grammar\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, pass `fetchExercises` and `validateAnswer` API wrappers
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Register `#quiz/{subjectId}` route for QuizScreen
    - Pattern: `/^quiz\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, pass `createSession`, `submitAnswer`, `skipQuestion`, `getResult`, `onComplete`
    - On completion, provide "Back to Subject" link → `#subject-{subjectName}` and "View Progress" link → `#progress`
    - _Requirements: 7.1, 7.2, 7.4, 15.3_

  - [x] 5.4 Register `#maths/{subjectId}` route for MathsPracticeScreen
    - Pattern: `/^maths\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, pass `fetchExercises`, `checkAnswer`, `onComplete`
    - _Requirements: 8.1, 8.2_

  - [x] 5.5 Register `#computers/{subjectId}` route for ComputersExerciseScreen
    - Pattern: `/^computers\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, pass `fetchExercise`, `onValidateMatches`, `onComplete`
    - _Requirements: 9.1, 9.2_

  - [x] 5.6 Register `#evs/{subjectId}` route for EVSVisualizationScreen
    - Pattern: `/^evs\/(?<subjectId>[^/]+)$/`
    - Extract `subjectId`, pass `fetchExerciseData`, `validateOrder`
    - _Requirements: 10.1, 10.2_

- [x] 6. Register utility and parent routes
  - [x] 6.1 Register `#progress` route for ProgressView
    - Pattern: `/^progress$/`
    - Fetch `progressApi.getProgress(studentId)` and `progressApi.getStreak(studentId)`
    - Render vanilla-DOM progress bars, streak, and recent activity
    - Replace existing placeholder `#progress` route
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 6.2 Register `#edit-subjects/{learnerId}` route for ParentDashboard (edit mode)
    - Pattern: `/^edit-subjects\/(?<learnerId>[^/]+)$/`
    - Extract `learnerId`, fetch current subject assignments via `parentApi.getLearners()`
    - Pass learner data + `parentApi.updateLearnerSubjects`
    - On save, call API and navigate back to `#dashboard`
    - _Requirements: 12.1, 12.3, 12.4_

- [x] 7. Implement Subject Landing page and navigation links
  - [x] 7.1 Create SubjectLandingView (`views/SubjectLandingView.ts`)
    - Implement `getExerciseLinksForSubject(subjectName)` to return conditional exercise links by subject category
    - Implement `createSubjectLandingView(subjectName, subjectId, color, icon, progressPercent)` with subject header and exercise link grid
    - Language subjects (Kannada, Hindi, English): show Pronunciation + Grammar + Quiz + Content Ingestion
    - Maths: show Maths Practice + Quiz + Content Ingestion
    - Computers: show Computers Exercises + Quiz + Content Ingestion
    - EVS: show EVS Visualizations + Quiz + Content Ingestion
    - Default: show Quiz + Content Ingestion
    - _Requirements: 13.2, 13.3, 5.4, 6.3, 7.3, 8.3, 9.3, 10.3_

  - [x] 7.2 Register `#subject-{name}` route in main.ts
    - Pattern: `/^subject-(?<subjectName>[^/]+)$/`
    - Resolve subject name → subject metadata (id, color, icon, progress) via `contentApi.getSubjects()`
    - Render `createSubjectLandingView` wrapped in ResponsiveLayout
    - Wire exercise link clicks to navigate to `#{exerciseType}/{subjectId}`
    - _Requirements: 13.1, 13.4_

  - [x] 7.3 Wire inter-screen navigation links
    - Update Parent Dashboard "View" button to navigate to `#edit-subjects/{learnerId}` (currently only logs)
    - Ensure learner dashboard subject cards navigate to `#subject-{subjectName}` (already wired in `renderSubjectCards`)
    - Verify sidebar subject highlighting on exercise routes via `activeRoute` prop
    - _Requirements: 12.2, 15.4, 15.5_

- [x] 8. Checkpoint — Full route integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Property-based tests for bridge and route utilities
  - [x] 9.1 Write property test for React Bridge lifecycle (Properties 1 & 2)
    - **Property 1: React Bridge Props Round-Trip** — mounting via `renderReactRoute(createElement(Component, props))` produces an HTMLElement where the component receives exactly the provided props
    - **Property 2: Fresh Root Per Navigation** — for any sequence of N navigations, exactly N roots are created and only one remains active
    - File: `utils/reactBridge.property.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 9.2 Write property test for route parameter extraction (Property 3)
    - **Property 3: Route Parameter Extraction** — for any parameterized route pattern and valid ID string, the handler extracts the correct ID value
    - File: `utils/routeParams.property.test.ts`
    - **Validates: Requirements 2.5, 2.6, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 12.3**

  - [x] 9.3 Write property test for Subject Landing conditional links (Properties 6 & 7)
    - **Property 6: Language-Subject Conditional Exercise Links** — Pronunciation and Grammar links appear if and only if subject is a language subject
    - **Property 7: Subject Landing Page Content Rendering** — exercise links match subject category; name, icon, color, progress are all rendered
    - File: `views/SubjectLandingView.property.test.ts`
    - **Validates: Requirements 5.4, 6.3, 13.2, 13.3, 13.4, 7.3, 8.3, 9.3, 10.3**

  - [x] 9.4 Write property test for async route error states (Properties 8, 9, 10)
    - **Property 8: Loading State on Data Fetch** — initial render contains a loading indicator with `role="status"`
    - **Property 9: Error State with Retry** — on failure, shows `role="alert"` element with "Retry" button that re-invokes the fetch
    - **Property 10: Auth Redirect on 401** — on 401, clears tokens and redirects to `#login`
    - File: `utils/asyncRoute.property.test.ts`
    - **Validates: Requirements 14.1, 14.2, 14.3**

- [x] 10. Integration tests for full route lifecycles
  - [x] 10.1 Write integration tests for route navigation flows
    - Test: navigate → loading → data loaded → screen mounted → navigate away → unmounted
    - Test: 401 flow → token refresh fails → redirect to `#login`
    - Test: API failure → ErrorView shown → click Retry → success → screen mounts
    - Test: Subject Landing → exercise screen navigation chain
    - File: `integration/routeLifecycle.test.ts`
    - **Validates: Requirements 1.2, 14.1, 14.2, 14.3, 15.1, 15.2**

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all implementation uses `.ts`/`.tsx` files
- Existing screens are already built in `packages/platform-web/app/src/screens/` — no screen component changes needed
- The existing `wrapInResponsiveLayout` function in `main.ts` is reused by the async route container
- Property tests use `fast-check` (already available in the monorepo via vitest)
- The `createAsyncRouteContainer` utility centralizes the loading → fetch → mount pattern to avoid duplication across 14 route handlers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "6.1", "6.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3", "9.4"] },
    { "id": 6, "tasks": ["10.1"] }
  ]
}
```
