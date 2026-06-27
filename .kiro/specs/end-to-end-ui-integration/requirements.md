# Requirements Document

## Introduction

This document specifies the requirements for wiring all remaining functional screen components into the ChikuMiku LearnVerse web application's hash router (`main.ts`). The screen components already exist as standalone React TSX files in `packages/platform-web/app/src/screens/`. The current router only registers authentication flows (login, register, forgot-password) and placeholder dashboard routes. This integration work bridges the React screen components into the vanilla-DOM hash router, connects them to the API client, adds inter-screen navigation links, and ensures consistent responsive layout wrapping.

## Glossary

- **Hash_Router**: The client-side routing system in `main.ts` that listens to `hashchange` events and renders the appropriate view element into the `#app` mount point
- **React_Bridge**: A utility function that creates an `HTMLElement` container, mounts a React component into it via `createRoot`, and returns the container for use in the vanilla-DOM hash router
- **Responsive_Layout**: The `wrapInResponsiveLayout` function that wraps content in a desktop navigation shell (TopNav + Sidebar) at viewport widths ≥960px and mobile bottom navigation at <960px
- **API_Client**: The centralized fetch-based HTTP client in `services/api.ts` that handles JWT token attachment, refresh, and typed API calls
- **Screen_Component**: A React TSX component in `packages/platform-web/app/src/screens/` that implements a functional feature (e.g., QuizScreen, PronunciationScreen)
- **Route_Registration**: Adding a `{ pattern, handler }` entry to the `routes` array passed to `createRouter` in `main.ts`
- **Tree_Sidebar**: The collapsible sidebar component showing hierarchical navigation (subjects → books → chapters)
- **Navigation_Link**: A clickable element that changes `window.location.hash` to navigate between screens

## Requirements

### Requirement 1: React-to-DOM Bridge Utility

**User Story:** As a developer, I want a reusable utility that mounts React components into the vanilla-DOM hash router, so that all existing React screen components can be rendered without rewriting them.

#### Acceptance Criteria

1. THE React_Bridge SHALL accept a React element and return an HTMLElement containing the mounted component
2. WHEN the Hash_Router replaces the mount point content (navigating away), THE React_Bridge SHALL unmount the React root to prevent memory leaks
3. THE React_Bridge SHALL support passing arbitrary props to the mounted React component
4. THE React_Bridge SHALL create a single React root per route render; repeated navigations to the same route SHALL create a fresh root each time

### Requirement 2: Content Ingestion Route Registration

**User Story:** As a Student, I want to navigate to the content ingestion flow from the dashboard or scan tab, so that I can upload and digitize my textbook pages.

#### Acceptance Criteria

1. WHEN a Student navigates to `#scan` or `#ingest`, THE Hash_Router SHALL render the ContentIngestionScreen wrapped in the Responsive_Layout
2. WHEN a Student selects a chapter in the ContentIngestionScreen, THE application SHALL navigate to `#upload/{chapterId}` to display the PageUploadUI
3. WHEN a Student completes page upload and text extraction, THE application SHALL navigate to `#transcript/{chapterId}` to display the ChapterTranscript
4. THE ContentIngestionScreen route handler SHALL fetch the Student's assigned subjects from the API_Client and pass them as props
5. THE PageUploadUI route handler SHALL extract the `chapterId` from the URL hash and pass it as a prop along with API methods for upload and OCR
6. THE ChapterTranscript route handler SHALL extract the `chapterId` from the URL hash and pass it as a prop along with API methods for saving transcripts

### Requirement 3: Chapter Explanation Route Registration

**User Story:** As a Student, I want to navigate to the chapter explanation screen after saving a transcript, so that I can read or listen to AI-generated explanations.

#### Acceptance Criteria

1. WHEN a Student navigates to `#explain/{chapterId}`, THE Hash_Router SHALL render the ChapterExplanationScreen wrapped in the Responsive_Layout
2. THE ChapterExplanationScreen route handler SHALL extract the `chapterId` from the URL hash and pass it along with API methods for fetching explanations, generating audio, creating revision questions, and generating summaries
3. WHEN a Student taps "Generate Revision Questions" and generation completes, THE ChapterExplanationScreen SHALL navigate to `#revision/{chapterId}`
4. THE ChapterTranscript screen SHALL display a "View Explanation" link that navigates to `#explain/{chapterId}`

### Requirement 4: Exercise Assistant Route Registration

**User Story:** As a Student, I want to access the exercise assistant for a chapter, so that I can get AI-powered help solving textbook exercises.

#### Acceptance Criteria

1. WHEN a Student navigates to `#exercises/{chapterId}`, THE Hash_Router SHALL render the ExerciseAssistant wrapped in the Responsive_Layout
2. THE ExerciseAssistant route handler SHALL extract the `chapterId` from the URL hash and pass it along with API methods for fetching exercise pages, requesting hints, and evaluating answers
3. THE ChapterExplanationScreen SHALL display an "Exercise Help" link that navigates to `#exercises/{chapterId}`

### Requirement 5: Pronunciation Practice Route Registration

**User Story:** As a Student, I want to navigate to pronunciation practice for a language subject, so that I can practice word pronunciation with recording and scoring.

#### Acceptance Criteria

1. WHEN a Student navigates to `#pronunciation/{subjectId}`, THE Hash_Router SHALL render the PronunciationScreen wrapped in the Responsive_Layout
2. THE PronunciationScreen route handler SHALL extract the `subjectId` from the URL hash, fetch the first pronunciation word from the API_Client, and pass it along with methods for fetching reference audio, submitting recordings, and navigating to the next word
3. WHEN a Student taps "Next" on the PronunciationScreen, THE application SHALL fetch the next word from the API_Client and re-render the component with updated props
4. THE subject landing page SHALL display a "Pronunciation Practice" Navigation_Link for language subjects (Kannada, Hindi, English) that navigates to `#pronunciation/{subjectId}`

### Requirement 6: Grammar Exercise Route Registration

**User Story:** As a Student, I want to navigate to grammar exercises for a language subject, so that I can practice fill-in-the-blank and sentence-construction exercises.

#### Acceptance Criteria

1. WHEN a Student navigates to `#grammar/{subjectId}`, THE Hash_Router SHALL render the GrammarExerciseScreen wrapped in the Responsive_Layout
2. THE GrammarExerciseScreen route handler SHALL extract the `subjectId` from the URL hash, fetch grammar exercises from the API_Client, and pass them along with submission and feedback methods
3. THE subject landing page SHALL display a "Grammar Exercises" Navigation_Link for language subjects (Kannada, Hindi, English) that navigates to `#grammar/{subjectId}`

### Requirement 7: Timed Quiz Route Registration

**User Story:** As a Student, I want to navigate to timed quizzes for any subject, so that I can test my knowledge under time pressure.

#### Acceptance Criteria

1. WHEN a Student navigates to `#quiz/{subjectId}`, THE Hash_Router SHALL render the QuizScreen wrapped in the Responsive_Layout
2. THE QuizScreen route handler SHALL extract the `subjectId` from the URL hash and pass API methods for creating sessions, submitting answers, skipping questions, and fetching results
3. THE subject landing page SHALL display a "Take Quiz" Navigation_Link that navigates to `#quiz/{subjectId}`
4. WHEN the QuizScreen completes (timer ends or all questions answered), THE application SHALL display the final score and provide a "Back to Subject" link navigating to `#subject-{subjectName}`

### Requirement 8: Maths Practice Route Registration

**User Story:** As a Student, I want to navigate to maths practice exercises, so that I can work with visual fractions and input validation.

#### Acceptance Criteria

1. WHEN a Student navigates to `#maths/{subjectId}`, THE Hash_Router SHALL render the MathsPracticeScreen wrapped in the Responsive_Layout
2. THE MathsPracticeScreen route handler SHALL extract the `subjectId` from the URL hash, fetch maths exercises from the API_Client, and pass them along with answer submission methods
3. THE subject landing page for Maths SHALL display a "Maths Practice" Navigation_Link that navigates to `#maths/{subjectId}`

### Requirement 9: Computers Exercise Route Registration

**User Story:** As a Student, I want to navigate to computer science exercises, so that I can practice code editing and drag-and-drop matching.

#### Acceptance Criteria

1. WHEN a Student navigates to `#computers/{subjectId}`, THE Hash_Router SHALL render the ComputersExerciseScreen wrapped in the Responsive_Layout
2. THE ComputersExerciseScreen route handler SHALL extract the `subjectId` from the URL hash, fetch exercises from the API_Client, and pass them along with submission and validation methods
3. THE subject landing page for Computers SHALL display a "Computers Exercises" Navigation_Link that navigates to `#computers/{subjectId}`

### Requirement 10: EVS Visualization Route Registration

**User Story:** As a Student, I want to navigate to EVS visualization exercises, so that I can interact with animated scientific processes and ordering exercises.

#### Acceptance Criteria

1. WHEN a Student navigates to `#evs/{subjectId}`, THE Hash_Router SHALL render the EVSVisualizationScreen wrapped in the Responsive_Layout
2. THE EVSVisualizationScreen route handler SHALL extract the `subjectId` from the URL hash, fetch visualization exercises from the API_Client, and pass them along with interaction submission methods
3. THE subject landing page for EVS SHALL display an "EVS Visualizations" Navigation_Link that navigates to `#evs/{subjectId}`

### Requirement 11: Progress Tracking Route

**User Story:** As a Student, I want to navigate to a progress tracking page, so that I can view my per-subject progress, streak, and recent activity.

#### Acceptance Criteria

1. WHEN a Student navigates to `#progress`, THE Hash_Router SHALL render a Progress screen wrapped in the Responsive_Layout showing per-subject progress bars, current streak, and recent activity list
2. THE Progress screen route handler SHALL fetch progress data from the API_Client (progress summary and streak endpoint) and pass it as props
3. IF the progress data fails to load, THEN THE Progress screen SHALL display an error message with a retry button
4. THE Web_Navigation "Progress" link and the mobile "Me" tab SHALL navigate to `#progress`

### Requirement 12: Parent Dashboard — Edit Subjects Route

**User Story:** As a Parent, I want to navigate to a screen to edit subjects for my learners, so that I can add or remove subjects from their profiles.

#### Acceptance Criteria

1. WHEN a Parent navigates to `#edit-subjects/{learnerId}`, THE Hash_Router SHALL render the ParentDashboard with the edit-subjects dialog open, wrapped in the Responsive_Layout
2. THE Parent Dashboard learner card "View" button SHALL navigate to `#edit-subjects/{learnerId}`
3. THE edit-subjects route handler SHALL extract the `learnerId` from the URL hash, fetch current subject assignments from the API_Client, and pass them along with update methods
4. WHEN the Parent saves subject changes, THE application SHALL call the API_Client to persist the update and navigate back to `#dashboard`

### Requirement 13: Subject Landing Route

**User Story:** As a Student, I want to land on a subject-specific page when I click a subject card, so that I can see all available exercise types and content for that subject.

#### Acceptance Criteria

1. WHEN a Student navigates to `#subject-{subjectName}`, THE Hash_Router SHALL render a Subject Landing screen wrapped in the Responsive_Layout
2. THE Subject Landing screen SHALL display Navigation_Links to the exercise types available for that subject: Pronunciation (language subjects), Grammar (language subjects), Quiz (all subjects), Maths (Maths subject), Computers (Computers subject), EVS (EVS subject), Content Ingestion (all subjects)
3. THE Subject Landing screen SHALL display the subject name, icon, color, and current progress percentage
4. WHEN a Student taps an exercise type link, THE application SHALL navigate to the corresponding hash route with the subject ID as a parameter

### Requirement 14: Loading and Error State Handling

**User Story:** As a Student, I want to see loading indicators while data is being fetched and clear error messages when something fails, so that I understand the application state at all times.

#### Acceptance Criteria

1. WHILE any route handler is fetching data from the API_Client, THE rendered screen SHALL display a loading indicator (spinner or skeleton) within the Responsive_Layout
2. IF an API call fails with a network error or 5xx status, THEN THE rendered screen SHALL display an error message describing the failure and a "Retry" button that re-attempts the failed request
3. IF an API call fails with a 401 status, THEN THE application SHALL redirect to `#login` after clearing stored tokens
4. THE loading and error states SHALL be styled consistently using the Design_System color tokens (background #F8F5FF, error red #E74C3C, border #E0D8EC)

### Requirement 15: Inter-Screen Navigation Consistency

**User Story:** As a Student, I want consistent navigation between related screens, so that I can move through learning flows without dead ends.

#### Acceptance Criteria

1. THE ChapterTranscript screen SHALL display a "Continue to Explanation" button that navigates to `#explain/{chapterId}`
2. THE ChapterExplanationScreen SHALL display a "Back to Transcript" link that navigates to `#transcript/{chapterId}`
3. THE QuizScreen completion summary SHALL display a "View Progress" link that navigates to `#progress`
4. WHEN a Student is on any exercise screen (Pronunciation, Grammar, Quiz, Maths, Computers, EVS), THE Responsive_Layout sidebar SHALL highlight the corresponding subject
5. THE learner dashboard subject cards SHALL navigate to `#subject-{subjectName}` when clicked, replacing the current placeholder behavior
