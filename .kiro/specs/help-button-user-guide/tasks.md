# Implementation Plan: Help Button & User Guide Viewer

## Overview

This plan implements a persistent help button and in-app User Guide viewer for the ChikuMiku LearnVerse platform. A build-time script converts `docs/USER_GUIDE.md` to static HTML with an embedded TOC. The viewer loads and displays this pre-built HTML, with offline caching support and full accessibility compliance.

## Tasks

- [x] 1. Create build script for markdown-to-HTML conversion
  - [x] 1.1 Create the build script `scripts/build-user-guide.ts`
    - Implement `convertMarkdownToHTML` function that reads `docs/USER_GUIDE.md`
    - Generate slug-based `id` attributes for all H2 and H3 headings
    - Build a `<nav class="ug-toc">` element with nested `<ol>` linking to anchors
    - Wrap content in `<article class="ug-content">` element
    - Output the static HTML to `packages/core/src/helpButton/user-guide.html`
    - Add a `marked` or `markdown-it` dev dependency for build-time conversion
    - Add a `build:user-guide` script to root `package.json`
    - _Requirements: 2.4, 3.1_

  - [ ]* 1.2 Write property test for TOC generation (Property 1)
    - **Property 1: Build script TOC generation contains only H2 and H3 headings in document order**
    - Generate random markdown with headings at levels H1–H6 using fast-check
    - Verify the output TOC `<nav>` contains links only to H2 and H3 headings
    - Verify links appear in the same relative order as in the source document
    - **Validates: Requirements 3.1**

  - [ ]* 1.3 Write property test for semantic element preservation (Property 2)
    - **Property 2: Build script preserves semantic element types**
    - Generate random markdown containing headings, bulleted lists, numbered lists, tables, and bold text
    - Verify output HTML contains `<h2>`/`<h3>`, `<ul>`, `<ol>`, `<table>`, `<strong>` elements
    - Verify each markdown construct maps to its correct HTML element
    - **Validates: Requirements 2.4**

- [x] 2. Implement core interfaces and state management
  - [x] 2.1 Create core help button interfaces and types in `packages/core/src/helpButton/`
    - Create `types.ts` with `HelpButtonConfig`, `HelpButtonState`, `HelpViewerConfig`, `HelpViewerState`, `AppStateSnapshot`, `LoadResult`, `UserGuideCacheEntry` interfaces
    - Create `index.ts` barrel export
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_

  - [x] 2.2 Implement `UserGuideCache` in `packages/core/src/helpButton/userGuideCache.ts`
    - Implement `get()`, `set()`, `has()`, `clear()` methods
    - Use localStorage with key `chikumiku:user-guide:html`
    - Store content with `cachedAt` timestamp and `version` hash
    - _Requirements: 6.2, 6.4_

  - [ ]* 2.3 Write property test for cache round-trip (Property 4)
    - **Property 4: User guide cache round-trip**
    - Generate random non-empty HTML strings using fast-check
    - Verify `set(content)` followed by `get()` returns the original content
    - Verify `has()` returns true after `set()`
    - **Validates: Requirements 6.4**

  - [x] 2.4 Implement `UserGuideSource` in `packages/core/src/helpButton/userGuideSource.ts`
    - Implement cache-first loading strategy
    - Add 2-second timeout for content loading
    - Implement retry logic with exponential backoff (1s, 2s, 4s, max 3 retries)
    - Handle offline detection and appropriate error messages
    - _Requirements: 2.3, 2.5, 6.1, 6.2, 6.5_

  - [x] 2.5 Implement `HelpViewerStateManager` in `packages/core/src/helpButton/stateManager.ts`
    - Implement `captureState()` to snapshot scroll position, form values, media positions, current route
    - Implement `restoreState()` to restore the captured snapshot
    - Implement `open()` and `close()` lifecycle methods
    - Handle state restoration failure with graceful fallback to parent screen
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.6 Write property test for state capture/restore round-trip (Property 3)
    - **Property 3: Help viewer open/close preserves application state**
    - Generate random `AppStateSnapshot` objects with arbitrary scroll positions, form values, media positions, and routes
    - Verify `captureState()` followed by `restoreState()` produces a state equal to the original
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement HelpButton component (Web)
  - [x] 4.1 Create `HelpButton` web component in `packages/core/src/helpButton/helpButton.ts`
    - Render a fixed-position button in the bottom-right corner of the viewport
    - Display a question mark icon with `aria-label="Help"`
    - Ensure minimum click target size of 44×44 CSS pixels
    - Maintain minimum 8px spacing from adjacent interactive elements
    - Show only on authenticated screens (not in full-screen modals or system overlays)
    - Wire `onClick` to trigger `HelpViewerStateManager.open()`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2_

  - [ ]* 4.2 Write unit tests for HelpButton component
    - Test aria-label is "Help"
    - Test fixed positioning in bottom-right corner
    - Test minimum target size of 44×44 CSS pixels
    - Test keyboard Tab navigation and Enter/Space activation
    - Test visibility on authenticated screens only
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 5.2_

- [x] 5. Implement HelpViewer component (Web)
  - [x] 5.1 Create `HelpViewer` overlay component in `packages/core/src/helpButton/helpViewer.ts`
    - Render as a modal overlay that displays the pre-built static HTML content
    - Inject the HTML content directly into the DOM (no runtime parsing)
    - Extract the `<nav class="ug-toc">` element to populate a TOC sidebar
    - If TOC nav is missing, hide the sidebar gracefully
    - Display loading state while content is being fetched
    - Display error state with retry button on load failure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

  - [x] 5.2 Implement TOC navigation within the HelpViewer
    - Render TOC entries from the `<nav>` element as a clickable sidebar list
    - On TOC entry click, scroll content view to the corresponding anchor within 0.5 seconds
    - Visually highlight the active TOC entry
    - Support vertical scrolling through the full content
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.3 Implement HelpViewer dismissal and focus management
    - Add close button that dismisses the viewer within 500ms
    - Handle Escape key to close the viewer on web
    - Trap keyboard focus within the viewer while open
    - Return focus to the HelpButton on close
    - Restore previous scroll position and application state on close
    - _Requirements: 3.4, 4.1, 4.3, 5.3, 5.4_

  - [ ]* 5.4 Write unit tests for HelpViewer component
    - Test loading state display
    - Test error state with retry button
    - Test HTML content rendering
    - Test TOC navigation and scroll behavior
    - Test close button, Escape key dismissal
    - Test focus trap and focus restore
    - Test 200% text resize without clipping
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.4, 4.3, 5.3, 5.4, 5.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement offline support and caching
  - [x] 7.1 Wire `UserGuideSource` with `UserGuideCache` for web offline support
    - On successful online load, cache the HTML content replacing any previous version
    - On offline access, serve from cache if available
    - If offline and no cache exists, display informational message about needing online access first
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 7.2 Add Android bundled asset support in `UserGuideSource`
    - Add platform-aware loading path: Android reads from bundled `assets/user_guide.html`
    - Ensure the help button remains visible and activatable while offline on Android
    - _Requirements: 6.1, 6.3_

  - [ ]* 7.3 Write unit tests for offline behavior
    - Test cache-first loading when offline
    - Test error message when offline with no cache (web)
    - Test Android bundled asset loading path
    - Test cache replacement on successful online load
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Implement accessibility compliance
  - [x] 8.1 Ensure accessibility requirements across HelpButton and HelpViewer
    - Verify color contrast ratio of 4.5:1 for text and 3:1 for interactive elements
    - Ensure text resizing up to 200% works without clipping or loss of functionality
    - Verify screen reader compatibility with proper ARIA attributes
    - Add `role="dialog"` and `aria-modal="true"` to the HelpViewer
    - Ensure all interactive elements have appropriate ARIA labels
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.2 Write accessibility unit tests
    - Test screen reader label on HelpButton
    - Test focus trap activation and deactivation
    - Test focus return to HelpButton on close
    - Test keyboard navigation (Tab, Enter, Space, Escape)
    - Test color contrast values meet WCAG thresholds
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 9. Wire everything together and integration
  - [x] 9.1 Integrate HelpButton into the authenticated app shell
    - Add HelpButton rendering to the main app layout after authentication
    - Ensure it appears on all screens except full-screen modals and system overlays
    - Connect HelpButton click to open HelpViewer with state capture
    - Connect HelpViewer close to state restoration
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1_

  - [x] 9.2 Add build script to the project build pipeline
    - Integrate `build:user-guide` script into the main `build` script in `package.json`
    - Ensure the static HTML is generated before the TypeScript compilation step
    - Verify the generated HTML file is included in the bundle output
    - _Requirements: 2.4, 3.1_

  - [ ]* 9.3 Write integration tests for the full help flow
    - Test: click help → viewer opens → HTML renders → TOC navigation → close → state restored
    - Test: offline with cache → viewer opens with cached content
    - Test: Android back button closes viewer
    - Test: content loads within 2-second threshold
    - _Requirements: 2.1, 2.2, 2.3, 3.2, 4.1, 4.2, 6.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The build script uses `marked` or `markdown-it` as a dev dependency (build-time only, not shipped to clients)
- The `packages/core/src/helpButton/` directory is the primary location for all shared logic
- Platform-specific UI rendering (Android views) would extend the same core interfaces

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.4", "2.5"] },
    { "id": 2, "tasks": ["2.3", "2.6", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "7.1", "7.2"] },
    { "id": 6, "tasks": ["7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3"] }
  ]
}
```
