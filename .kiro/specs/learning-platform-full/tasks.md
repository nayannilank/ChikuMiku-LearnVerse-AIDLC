# Implementation Plan: ChikuMiku LearnVerse Learning Platform

## Overview

This plan implements the full ChikuMiku LearnVerse learning platform in 10 phases — from CDK infrastructure through subject exercises to final integration. Each task references specific requirements and builds incrementally on previous work. TypeScript is used throughout (AWS CDK, Node.js Lambda, React web, React Native mobile).

## Tasks

- [ ] 1. Foundation — CDK Infrastructure and Shared Contracts

  - [ ] 1.1 Define CDK stacks for PostgreSQL (with pgvector), S3, Cognito, API Gateway, and Lambda scaffolding
    - Create `infra/cdk/lib/DatabaseStack.ts` with RDS PostgreSQL instance, pgvector extension, security groups
    - Create `infra/cdk/lib/StorageStack.ts` with S3 bucket (lifecycle policies for audio/images)
    - Create `infra/cdk/lib/AuthStack.ts` with Cognito user pool, parent/student groups
    - Create `infra/cdk/lib/ApiStack.ts` with API Gateway REST API, Cognito authorizer, Lambda integrations
    - Create `infra/cdk/lib/ComputeStack.ts` with Lambda function scaffolding for all 8 service domains
    - Create `infra/cdk/lib/CdnStack.ts` with CloudFront distribution for web app and S3 assets
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 1.2 Write property test for API contract preservation (CDK)
    - **Property 1: JWT Parsing and Claim Extraction** (infrastructure aspect — Cognito authorizer on all routes)
    - **Validates: Requirements 2.5, 2.6**

  - [ ] 1.3 Define shared TypeScript contracts in `packages/platform-contracts`
    - Create `src/models.ts` with all interfaces (Parent, Student, Subject, Book, Chapter, Exercise, etc.)
    - Create `src/api-types.ts` with request/response types for all 40+ API endpoints
    - Create `src/validation-rules.ts` with shared validation constants (field lengths, patterns)
    - Create `src/errors.ts` with ApiErrorResponse interface and error codes
    - _Requirements: 2.1, 18.1, 18.4_

  - [ ] 1.4 Implement core service middleware in `packages/services/core`
    - Create `src/middleware/authContext.ts` — extract user ID, role, groups from JWT claims
    - Create `src/middleware/errorHandler.ts` — global error handler returning ApiErrorResponse format
    - Create `src/middleware/validation.ts` — request body validation using shared rules
    - Create `src/middleware/logger.ts` — structured logging with sensitive data masking
    - Create `src/types.ts` — Lambda handler types, middleware chain types
    - _Requirements: 1.1, 1.5, 18.4, 18.5, 23.1, 23.2, 23.7_

  - [ ]* 1.5 Write property test for structured logging with sensitive data masking
    - **Property 28: Structured Logging with Sensitive Data Masking**
    - Verify all log entries contain required fields (timestamp ISO 8601, userId, operationType, result)
    - Verify passwords, JWT tokens, OTP values never appear in log output
    - Verify emails are masked in "d***@domain.com" format
    - **Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.7**

  - [ ]* 1.6 Write property test for JWT parsing and claim extraction
    - **Property 1: JWT Parsing and Claim Extraction**
    - Generate random valid JWT payloads and verify correct user ID extraction
    - Generate expired, malformed, tampered JWTs and verify 401 rejection
    - **Validates: Requirements 1.1, 1.5, 18.5**

- [ ] 2. Checkpoint — Foundation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Authentication — Registration, Login, Password Recovery, Logout

  - [ ] 3.1 Implement parent registration Lambda handler
    - Create `packages/services/auth/src/handlers/registerParent.ts`
    - Validate all fields (username 8-15 chars, name 5-20 chars, phone 10 digits, email ≤30 chars, password complexity)
    - Create Cognito user, add to "parent" group, insert into `parents` table
    - Return 201 with parent ID or 409 for duplicate username/email/phone
    - _Requirements: 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.44, 1.45, 1.46, 1.47_

  - [ ] 3.2 Implement student registration Lambda handler
    - Create `packages/services/auth/src/handlers/registerStudent.ts`
    - Validate fields (username, name, password, grade, school name 5-30 chars)
    - Validate at least one subject selected; support custom subjects (1-50 chars)
    - Create Cognito user, add to "student" group, insert into `students` table
    - Seed `student_subjects` table with assigned subjects
    - _Requirements: 1.20, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28, 1.29, 1.30_

  - [ ]* 3.3 Write property test for registration input validation
    - **Property 2: Registration Input Validation**
    - Generate random strings at boundary lengths for each field
    - Verify acceptance of valid inputs and rejection with field-specific errors for invalid inputs
    - **Validates: Requirements 1.14–1.30**

  - [ ] 3.4 Implement login Lambda handler with role-based routing
    - Create `packages/services/auth/src/handlers/login.ts`
    - Authenticate against Cognito with username + password + role
    - Return JWT access token + refresh token on success
    - Return 401 with "incorrect username or password" on failure
    - _Requirements: 1.2, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12_

  - [ ]* 3.5 Write property test for role-based navigation routing
    - **Property 4: Role-Based Navigation Routing**
    - Generate random users with parent/student roles
    - Verify parent → Parent Dashboard, student → Learner Dashboard
    - **Validates: Requirements 1.11, 22.1**

  - [ ] 3.6 Implement password recovery flow (forgot-password, verify-otp, reset-password)
    - Create `packages/services/auth/src/handlers/forgotPassword.ts` — send OTP to email + phone
    - Create `packages/services/auth/src/handlers/verifyOtp.ts` — validate both OTPs (10-min expiry)
    - Create `packages/services/auth/src/handlers/resetPassword.ts` — update password in Cognito
    - _Requirements: 1.31, 1.32, 1.33, 1.34, 1.35, 1.36, 1.37, 1.38_

  - [ ] 3.7 Implement logout handler with state persistence
    - Create `packages/services/auth/src/handlers/logout.ts`
    - Persist progress, exercise results, and session data to PostgreSQL before invalidating tokens
    - Clear local JWT tokens on client side
    - _Requirements: 1.39, 1.40, 1.41, 1.42_

  - [ ]* 3.8 Write property test for logout state round-trip
    - **Property 5: Logout State Round-Trip**
    - Generate random progress states (percentages, streak, last viewed chapter/page)
    - Verify state persisted on logout matches state restored on re-login
    - **Validates: Requirements 1.41, 1.42, 1.43**

  - [ ] 3.9 Implement parent's learner list and edit subjects endpoints
    - Create `packages/services/auth/src/handlers/getParentLearners.ts` — GET `/parent/learners`
    - Create `packages/services/auth/src/handlers/editLearnerSubjects.ts` — PUT `/parent/learners/:id/subjects`
    - Enforce minimum 1 subject constraint
    - _Requirements: 22.2, 22.4, 22.6, 22.7_

  - [ ]* 3.10 Write property test for parent-learner association
    - **Property 27: Parent-Learner Association**
    - Generate random parent-student relationships
    - Verify learner list count matches registered students; verify min 1 subject enforcement
    - **Validates: Requirements 22.2, 22.6, 22.7**

  - [ ] 3.11 Build Login screen UI (React web)
    - Create `packages/platform-web/app/src/screens/LoginScreen.tsx`
    - Role selector (Parent/Learner), username field, password field (masked), Login button, Forgot Password link
    - Error state: show error message, preserve username, clear password on failure
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13_

  - [ ] 3.12 Build Parent Registration form UI (React web)
    - Create `packages/platform-web/app/src/screens/ParentRegistrationForm.tsx`
    - All fields with inline validation on blur/type, submit button "Register Parent"
    - Handle server errors (duplicate username/email/phone → field-specific messages, 5xx → preserve fields)
    - _Requirements: 1.14–1.19, 1.44–1.49_

  - [ ] 3.13 Build Student Registration form UI (React web)
    - Create `packages/platform-web/app/src/screens/StudentRegistrationForm.tsx`
    - Pre-filled parent username (read-only), all student fields, grade dropdown, subject checkboxes
    - "Add Subject" option for custom subjects (1-50 chars), minimum 1 subject validation
    - _Requirements: 1.20–1.30, 1.44–1.49_

  - [ ]* 3.14 Write property test for form error state preservation
    - **Property 3: Form Error State Preservation**
    - Generate random form values with mixed valid/invalid fields
    - Verify valid field values preserved unchanged; error indicators only on invalid fields
    - **Validates: Requirements 1.44, 1.45, 1.46, 1.47, 1.48, 1.49**

  - [ ] 3.15 Build Password Recovery flow UI (React web)
    - Create `packages/platform-web/app/src/screens/PasswordRecoveryFlow.tsx`
    - Step 1: Email + phone form; Step 2: Dual OTP input; Step 3: New password
    - Handle expired OTP (10 min), resend option, success redirect to login
    - _Requirements: 1.31–1.38_

- [ ] 4. Checkpoint — Authentication complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Navigation and Design System

  - [ ] 5.1 Create design tokens CSS and ThemeProvider
    - Create `packages/platform-web/app/src/theme/tokens.ts` with all color, typography, spacing, radius, shadow tokens
    - Create `packages/platform-web/app/src/theme/ThemeProvider.tsx` wrapping the app with CSS variables
    - Define subject-specific colors for 7 defaults + custom subject palette assignment logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for custom subject color non-conflict
    - **Property 6: Custom Subject Color Non-Conflict**
    - Generate random custom subject color assignments
    - Verify assigned color never equals any of 7 default subject colors or other custom subject colors
    - **Validates: Requirements 3.4**

  - [ ] 5.3 Build web navigation (top bar + sidebar)
    - Create `packages/platform-web/app/src/components/TopNavigation.tsx` — logo, links (Dashboard, Subjects, Revision, Progress), user avatar, logout button
    - Create `packages/platform-web/app/src/components/Sidebar.tsx` — subject list with icons and progress indicators (>960px)
    - Create `packages/platform-web/app/src/components/NavigationShell.tsx` — layout wrapper combining TopNav + Sidebar + content area
    - _Requirements: 4.3, 4.4, 4.5, 3.6_

  - [ ] 5.4 Build mobile bottom navigation component
    - Create `packages/platform-mobile/ui/src/components/BottomNavigation.tsx` — 5 tabs (Home, Chapters, Scan, Revision, Me) with icons, labels, active highlight
    - 44px height, full-width on mobile viewports (320-420px)
    - _Requirements: 4.1, 4.2, 3.5_

  - [ ] 5.5 Build responsive layout shell with breakpoints
    - Integrate NavigationShell in web app with route-based content rendering
    - Apply mobile layout patterns (full-width, bottom nav) for <960px
    - Apply desktop layout patterns (top nav, sidebar) for ≥960px
    - _Requirements: 3.5, 3.6, 4.1–4.5_

- [ ] 6. Dashboard — Streak Tracking and Learner/Parent Views

  - [ ] 6.1 Implement streak tracking backend in Progress service
    - Create `packages/services/sync/src/handlers/getStreak.ts` — GET `/progress/:studentId/streak`
    - Create `packages/services/sync/src/handlers/updateStreak.ts` — called on exercise completion
    - Increment streak on first exercise of new calendar day
    - Reset streak to 0 on second consecutive missed day
    - _Requirements: 5.1, 5.2, 5.4, 19.3, 19.4_

  - [ ]* 6.2 Write property test for streak calculation
    - **Property 7: Streak Calculation**
    - Generate random sequences of activity days
    - Verify streak equals length of most recent consecutive daily run
    - Verify reset to zero on second missed day; verify non-negative integer
    - **Validates: Requirements 5.1, 5.2, 5.4, 6.2, 19.3, 19.4**

  - [ ] 6.3 Build Learner Dashboard screen (React web)
    - Create `packages/platform-web/app/src/screens/Dashboard.tsx`
    - Greeting header: student name (truncated 30 chars) + date ("Day, DD Month")
    - Streak display: fire icon, gold color, integer count + "days" label
    - Subject card grid: 2 columns mobile / 3 columns web, subject color, icon, progress %
    - Loading state: indicators for streak and progress; error state: placeholder + error message
    - Navigation to subject landing on card tap (<300ms)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 6.4 Write property test for dashboard name truncation and date formatting
    - **Property 9: Dashboard Name Truncation and Date Formatting**
    - Generate random names (1-100 chars), verify at most 30 chars displayed
    - Generate random dates, verify "Day, DD Month" format
    - **Validates: Requirements 6.1**

  - [ ]* 6.5 Write property test for subject filtering (only assigned subjects)
    - **Property 8: Subject Filtering — Only Assigned Subjects Displayed**
    - Generate random student-subject assignments
    - Verify dashboard displays exactly N assigned subjects with no unassigned leakage
    - **Validates: Requirements 6.3, 7.1**

  - [ ] 6.6 Build Parent Dashboard screen (React web)
    - Create `packages/platform-web/app/src/screens/ParentDashboard.tsx`
    - Learner list with name + grade; tap to view learner progress
    - Learner progress view: subject cards with progress %, streak, recent activity
    - "Register Student" button; empty state with prompt if no learners
    - "Edit Subjects" dialog: checkboxes for assigned subjects, add/remove, min 1 enforced
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

- [ ] 7. Checkpoint — Dashboard and Navigation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Content Ingestion — Selection, Upload, OCR, Transcript

  - [ ] 8.1 Build Subject/Book/Chapter selection UI
    - Create `packages/platform-web/app/src/screens/ContentIngestionScreen.tsx`
    - Display only assigned subjects; books with name + chapter count; chapters with status
    - "Add New Book" and "Add New Chapter" dialogs (name 1-200 chars)
    - Web: sidebar + main content side by side; Mobile: step-by-step flow
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 8.2 Write property test for content name validation
    - **Property 10: Content Name Validation**
    - Generate random strings (0-500 chars)
    - Verify accept 1-200 chars, reject empty or >200 chars
    - **Validates: Requirements 7.3, 7.5**

  - [ ] 8.3 Build Page Upload UI (camera, gallery, drag-drop)
    - Create `packages/platform-web/app/src/screens/PageUploadUI.tsx`
    - "Take Photo" (camera capture JPEG) and "Upload Images" (file picker: JPEG, PNG, HEIC)
    - Web: drag-and-drop drop zone in addition to file picker
    - Validate ≤10MB per image; max 50 pages per chapter
    - Thumbnail grid with numbered pages, total count ("4 of 50 max"), delete button per page
    - "Done — Extract Text" button to upload and trigger OCR
    - "Supported: JPEG, PNG, HEIC • Max 10MB per image" notice
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

  - [ ]* 8.4 Write property test for upload validation constraints
    - **Property 11: Upload Validation Constraints**
    - Generate random file sizes (0-50MB) and page counts (0-100)
    - Verify rejection of files >10MB; verify rejection beyond 50 pages
    - **Validates: Requirements 8.4, 8.5, 8.6**

  - [ ] 8.5 Implement Content Ingestion backend (page upload + OCR)
    - Create `packages/services/content-ingestion/src/handlers/uploadPages.ts` — POST `/chapters/:id/pages`
    - Upload images to S3 with unique keys; insert `chapter_pages` records
    - Create `packages/services/content-ingestion/src/handlers/extractText.ts` — POST `/chapters/:id/extract`
    - Call AI Gateway → Google Vision OCR for each page; update `chapter_pages.extracted_text`
    - Support Kannada, English, Hindi, mathematical notation, Indic scripts
    - Handle partial failure: mark failed pages while showing successful ones
    - _Requirements: 9.1, 9.2, 9.9, 9.10_

  - [ ] 8.6 Build Chapter Transcript screen (view, edit, save)
    - Create `packages/platform-web/app/src/screens/ChapterTranscript.tsx`
    - Display extracted text organized page by page (page number, word count, text)
    - Total pages processed + total word count summary
    - "Edit Transcript" button for manual corrections; "Save Transcript" button
    - Web: image thumbnails left, text right; Mobile: scrollable page text blocks
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 8.7 Implement transcript save/edit backend
    - Create `packages/services/content-ingestion/src/handlers/saveTranscript.ts` — PUT `/chapters/:id/transcript`
    - Persist transcript content in database; update chapter `has_content`, `total_word_count`
    - _Requirements: 9.5, 9.6_

  - [ ]* 8.8 Write property test for word count calculation
    - **Property 12: Word Count Calculation**
    - Generate random text strings with various whitespace patterns
    - Verify per-page word count = whitespace-separated token count
    - Verify total word count = sum of per-page word counts
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 8.9 Write property test for transcript round-trip
    - **Property 13: Transcript Round-Trip**
    - Generate random unicode text content
    - Verify save then retrieve produces identical content
    - **Validates: Requirements 9.5, 9.6**

  - [ ] 8.10 Implement exercise page classification
    - Create `packages/services/content-ingestion/src/handlers/classifyPages.ts` — POST `/chapters/:id/classify-pages`
    - AI classification to identify exercise pages; return confirmation prompt
    - Student confirms/denies exercise classification
    - _Requirements: 11.1, 11.2_

- [ ] 9. Checkpoint — Content Ingestion complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. AI-Powered Learning — Explanations, TTS, Revision, Summary, Translation, Exercise Assistant

  - [ ] 10.1 Implement AI Gateway service
    - Create `packages/services/ai-gateway/src/index.ts` — request router, cache check, API key manager
    - Implement generate-once-store-permanently pattern with `ai_cache` table lookup
    - Implement retry handler (3 attempts, exponential backoff: 1s, 2s, 4s)
    - Implement circuit breaker (opens after 5 failures, half-open after 30s)
    - Configure timeouts: OCR 30s, text gen 15s, embeddings 10s, TTS 60s
    - _Requirements: 2.7, 2.8_

  - [ ]* 10.2 Write property test for generate-once caching
    - **Property 14: Generate-Once Cache Consistency**
    - Generate random chapter/page IDs with mock AI service
    - Verify first request calls AI; subsequent requests return cached without AI call
    - **Validates: Requirements 10.1, 10.4, 10.10, 10.11, 10.12, 10.13, 10.16, 12.3, 20.5**

  - [ ] 10.3 Implement chapter explanation endpoint
    - Create `packages/services/comprehension/src/handlers/getExplanation.ts` — GET `/chapters/:id/explanation`
    - Generate explanation via GPT-5 Mini (summary, key words with romanization/meaning, concepts)
    - Store permanently in `ai_cache`; return cached on subsequent requests
    - Page-by-page navigation support
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.9_

  - [ ] 10.4 Implement TTS audio generation endpoint
    - Create `packages/services/comprehension/src/handlers/generateAudio.ts` — POST `/chapters/:id/explanation/audio`
    - Generate audio via Google TTS through AI Gateway; store MP3 in S3
    - Serve via CloudFront CDN URL; generate-once pattern
    - _Requirements: 10.4_

  - [ ] 10.5 Implement revision questions generation endpoint
    - Create `packages/services/comprehension/src/handlers/generateRevisionQuestions.ts` — POST `/chapters/:id/revision-questions`
    - Create `packages/services/comprehension/src/handlers/getRevisionQuestions.ts` — GET `/chapters/:id/revision-questions`
    - Generate MCQs, short answer, fill-in-the-blank via GPT-5 Mini
    - Store permanently; return stored on subsequent requests
    - _Requirements: 10.10, 10.12_

  - [ ] 10.6 Implement chapter summary generation endpoint
    - Create `packages/services/comprehension/src/handlers/generateSummary.ts` — POST `/chapters/:id/summary`
    - Create `packages/services/comprehension/src/handlers/getSummary.ts` — GET `/chapters/:id/summary`
    - Generate key points, important concepts, exam prep notes
    - Store permanently; return stored on subsequent requests
    - _Requirements: 10.11, 10.13_

  - [ ] 10.7 Implement translation endpoint
    - Create `packages/services/comprehension/src/handlers/translate.ts` — POST `/chapters/:id/translate`
    - Translate explanation to English/Hindi for language subjects via GPT-5 Mini
    - Generate-once per language per chapter page; store permanently
    - _Requirements: 10.14, 10.15, 10.16_

  - [ ] 10.8 Implement exercise assistant (RAG + hint + evaluate)
    - Create `packages/services/comprehension/src/handlers/getHint.ts` — POST `/exercises/:id/hint`
    - Implement pgvector similarity search: embed query → retrieve top 5 paragraphs → GPT-5 Mini hint
    - Create `packages/services/comprehension/src/handlers/evaluate.ts` — POST `/exercises/:id/evaluate`
    - Grade answer with GPT-5 Mini as grade-appropriate teacher; reference relevant chapter section
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 10.9 Write property test for RAG retrieval returns top-5
    - **Property 15: RAG Retrieval Returns Top-5**
    - Generate random embedding vectors with varying corpus sizes
    - Verify exactly 5 results returned, ordered by descending cosine similarity
    - **Validates: Requirements 11.5**

  - [ ] 10.10 Build Chapter Explanation screen UI (React web)
    - Create `packages/platform-web/app/src/screens/ChapterExplanationScreen.tsx`
    - Read/Listen mode toggle (default Read); page navigation (Previous/Next)
    - Read mode: formatted text with Summary, Key Words, Concepts sections
    - Listen mode: play TTS audio from CDN
    - "Generate Revision Questions" / "View Revision Questions" button (state-dependent)
    - "Generate Summary" / "View Summary" button (state-dependent)
    - Translation selector for language subjects (English/Hindi)
    - Web: original text left, explanation right; Mobile: scrollable card
    - _Requirements: 10.1–10.16_

  - [ ] 10.11 Build Exercise Assistant screen UI (React web)
    - Create `packages/platform-web/app/src/screens/ExerciseAssistant.tsx`
    - Display parsed exercise items with original text and answer interface
    - "Get Hint" button → show contextual hint (without full answer)
    - Submit answer → show feedback (correct/incorrect with explanation)
    - Incorrect answers → reference relevant chapter section
    - Completion summary (score: correct/total)
    - _Requirements: 11.1–11.10_

  - [ ]* 10.12 Write property test for exercise completion score calculation
    - **Property 16: Exercise Completion Score Calculation**
    - Generate random correct/incorrect sequences
    - Verify score = correct count and total = total exercises
    - **Validates: Requirements 11.10, 13.1**

- [ ] 11. Checkpoint — AI-Powered Learning complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Subject Exercises — Pronunciation, Grammar, Quiz, Maths, Computers, EVS

  - [ ] 12.1 Implement Pronunciation service backend
    - Create `packages/services/pronunciation/src/handlers/uploadRecording.ts` — POST `/pronunciation/record`
    - Upload audio to S3 (key: studentId + subject + timestamp)
    - Invoke Whisper transcription via AI Gateway; compare to expected word
    - Calculate syllable-level accuracy score (0-100); return within 5 seconds
    - Validate recording duration (0.5s–15s)
    - Create `packages/services/pronunciation/src/handlers/getReferenceAudio.ts` — GET `/pronunciation/reference/:wordId`
    - Return CDN URL for reference audio (generate-once via Google TTS)
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ]* 12.2 Write property test for pronunciation scoring
    - **Property 17: Pronunciation Scoring**
    - Generate random syllable arrays and transcriptions
    - Verify score is 0-100 inclusive; syllable results array has exactly N entries
    - **Validates: Requirements 12.5, 12.6**

  - [ ]* 12.3 Write property test for recording duration validation
    - **Property 18: Recording Duration Validation**
    - Generate random durations (0-30s)
    - Verify <0.5s or >15s returns error; 0.5-15s inclusive accepted
    - **Validates: Requirements 12.4, 20.6**

  - [ ]* 12.4 Write property test for audio upload key uniqueness
    - **Property 26: Audio Upload Key Uniqueness**
    - Generate random student/subject/timestamp combinations
    - Verify all generated S3 keys are unique (no collisions)
    - **Validates: Requirements 20.1**

  - [ ] 12.5 Build Pronunciation screen UI (React web)
    - Create `packages/platform-web/app/src/screens/PronunciationScreen.tsx`
    - Display word at correct font size (32px English, 40px Hindi, 52px Kannada)
    - Phonetic transcription below word; audio playback button (reference TTS)
    - Record button → stop button (max 10s); display accuracy % and syllable highlights (green/red)
    - Retry button, Next button; microphone permission error handling
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

  - [ ] 12.6 Implement Grammar service backend
    - Create `packages/services/grammar/src/handlers/validateAnswer.ts`
    - Validate grammar answers against correct solutions
    - Generate explanatory feedback via GPT-5 Mini for incorrect answers
    - _Requirements: 13.5, 13.6, 13.7_

  - [ ] 12.7 Build Grammar Exercise screen UI (React web)
    - Create `packages/platform-web/app/src/screens/GrammarExerciseScreen.tsx`
    - Question counter "N/T" (T between 1-30); progress bar (N/T × 100%)
    - Sentence with underscore placeholder; 2-5 multiple-choice options
    - Select → pink highlight + feedback panel (green success / red error with explanation)
    - Next button disabled until answered; completion summary on last question
    - _Requirements: 13.1–13.11_

  - [ ]* 12.8 Write property test for grammar exercise progress format
    - **Property 19: Grammar Exercise Progress Format**
    - Generate random N and T values (1 ≤ N ≤ T, 1 ≤ T ≤ 30)
    - Verify progress displays "N/T" and bar shows N/T × 100 percentage
    - **Validates: Requirements 13.1, 13.2**

  - [ ] 12.9 Implement Quiz session management backend
    - Create `packages/services/sync/src/handlers/createQuizSession.ts` — POST `/quiz/sessions`
    - Generate unique session ID, record start time, associate question set
    - Create `packages/services/sync/src/handlers/submitQuizAnswer.ts` — POST `/quiz/sessions/:id/answer`
    - Validate answer, reject duplicates (same question in same session), update running score
    - Create `packages/services/sync/src/handlers/skipQuestion.ts` — POST `/quiz/sessions/:id/skip`
    - Create `packages/services/sync/src/handlers/getQuizResult.ts` — GET `/quiz/sessions/:id/result`
    - Calculate final score as percentage when session ends
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ]* 12.10 Write property test for quiz score calculation
    - **Property 20: Quiz Score Calculation**
    - Generate random answer sequences (correct/incorrect/skip)
    - Verify running score = (correct / answered) × 100; final = (correct / total) × 100
    - **Validates: Requirements 14.5, 14.6, 14.8, 21.2, 21.3**

  - [ ]* 12.11 Write property test for quiz answer uniqueness
    - **Property 21: Quiz Answer Uniqueness**
    - Generate random answer submissions with duplicates
    - Verify duplicate submissions for same question in same session are rejected
    - **Validates: Requirements 21.4**

  - [ ] 12.12 Build Quiz screen UI (React web)
    - Create `packages/platform-web/app/src/screens/QuizScreen.tsx`
    - Countdown timer (MM:SS, 30s–60min); question counter "Q8/20"
    - 4 answer options (A/B/C/D) as tappable cards; Submit + Skip buttons
    - Selected option → pink highlight; Submit without selection → inline prompt
    - Web: live score panel (percentage + correct count)
    - Timer reaches 0 or last question → final score summary
    - Navigation away confirmation dialog
    - _Requirements: 14.1–14.10_

  - [ ] 12.13 Build Maths Practice screen UI (React web)
    - Create `packages/platform-web/app/src/screens/MathsPracticeScreen.tsx`
    - Visual fraction representation (circles/rectangles with colored portions)
    - Numerator + denominator input fields (integers 0-99); "Check Answer" button
    - Validation: empty/non-integer → inline message
    - Correct → green success; Incorrect → red + hint (which part is wrong)
    - Question counter "3/10" (5-20 questions per set)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 12.14 Write property test for maths input validation
    - **Property 29: Maths Input Validation**
    - Generate random numeric and non-numeric strings
    - Verify accept integers 0-99; reject empty, non-integer, out-of-range
    - **Validates: Requirements 15.2, 15.4**

  - [ ] 12.15 Build Computers Exercise screen UI (React web)
    - Create `packages/platform-web/app/src/screens/ComputersExerciseScreen.tsx`
    - Code editor with syntax highlighting; drag-and-drop matching (3-8 pairs)
    - "Check Matches" before complete → show remaining count
    - All matched → validate → green (correct) / red (incorrect) indicators
    - "Reset" button to clear all matches
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 12.16 Write property test for computers exercise match validation
    - **Property 30: Computers Exercise Match Validation**
    - Generate random pair orderings (3-8 pairs)
    - Verify incomplete submission reports remaining count; complete submission marks each correct/incorrect
    - **Validates: Requirements 16.2, 16.3, 16.4, 16.5**

  - [ ] 12.17 Build EVS Visualization screen UI (React web)
    - Create `packages/platform-web/app/src/screens/EVSVisualizationScreen.tsx`
    - Animated visualization (emoji/icon sequences, loops continuously)
    - Labeled stage descriptions (3-8 stages); drag-and-drop ordering (randomized initial order)
    - "Check Order" → correct items green with checkmarks, incorrect in default blue
    - EVS quiz: MCQ with scientific explanation on correct answer
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

  - [ ]* 12.18 Write property test for EVS ordering validation
    - **Property 31: EVS Ordering Validation**
    - Generate random stage sequences (3-8 stages)
    - Verify initial order randomized (different from correct); per-item correctness marking
    - **Validates: Requirements 17.3, 17.4, 17.5, 17.6**

- [ ] 13. Checkpoint — Subject Exercises complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Backend APIs — Content Management, Progress Tracking

  - [ ] 14.1 Implement Content Management API (CRUD, pagination, filtering)
    - Create `packages/services/content-store/src/handlers/listExercises.ts` — GET `/exercises`
    - Paginated (default 20, max 100), ordered by sequence number
    - Filter by subject, chapter, exercise type, difficulty level
    - Empty results → 200 with empty list and zero total
    - Create `packages/services/content-store/src/handlers/createExercise.ts` — POST `/exercises` → 201
    - Create `packages/services/content-store/src/handlers/updateExercise.ts` — PUT `/exercises/:id`
    - Create `packages/services/content-store/src/handlers/deleteExercise.ts` — DELETE `/exercises/:id`
    - Validate required fields → 400 with field-specific errors; auth check → 401
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [ ]* 14.2 Write property test for pagination bounds
    - **Property 22: Pagination Bounds**
    - Generate random page sizes (0-200) and data set sizes
    - Verify effective page size clamped to [1, 100] with default 20; response ≤ pageSize items
    - **Validates: Requirements 18.2**

  - [ ]* 14.3 Write property test for API request validation and filtering
    - **Property 23: API Request Validation and Filtering**
    - Generate random request payloads with missing/invalid fields → verify 400
    - Generate filter combinations → verify all returned results match all filters
    - Verify zero-match filters → 200 with empty list
    - **Validates: Requirements 18.4, 18.6, 18.7**

  - [ ] 14.4 Implement Content Store endpoints (subjects, books, chapters)
    - Create `packages/services/content-store/src/handlers/listSubjects.ts` — GET `/subjects`
    - Create `packages/services/content-store/src/handlers/listBooks.ts` — GET `/subjects/:id/books`
    - Create `packages/services/content-store/src/handlers/createBook.ts` — POST `/subjects/:id/books`
    - Create `packages/services/content-store/src/handlers/listChapters.ts` — GET `/books/:id/chapters`
    - Create `packages/services/content-store/src/handlers/createChapter.ts` — POST `/books/:id/chapters`
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 18.1_

  - [ ] 14.5 Implement Progress tracking endpoints
    - Create `packages/services/sync/src/handlers/getProgress.ts` — GET `/progress/:studentId`
    - Return per-subject progress percentages, streak, recent activity
    - Create `packages/services/sync/src/handlers/recordExerciseResult.ts` — POST `/progress/:studentId/exercise-result`
    - Record result, update progress percentage, trigger streak update
    - _Requirements: 19.1, 19.2, 19.5_

  - [ ]* 14.6 Write property test for progress percentage calculation
    - **Property 24: Progress Percentage Calculation**
    - Generate random completed/total pairs
    - Verify percentage = floor(C/T × 100) clamped to [0, 100]
    - **Validates: Requirements 19.2**

  - [ ] 14.7 Implement historical quiz scores endpoint
    - Create `packages/services/sync/src/handlers/getQuizHistory.ts`
    - Support date range filtering; return sessions ordered by date descending
    - _Requirements: 19.6, 21.5_

  - [ ]* 14.8 Write property test for historical quiz scores date range
    - **Property 25: Historical Quiz Scores Date Range**
    - Generate random date ranges and quiz timestamps
    - Verify all returned results have timestamps within specified range, ordered descending
    - **Validates: Requirements 19.6, 21.5**

- [ ] 15. Checkpoint — Backend APIs complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Logging and Observability

  - [ ] 16.1 Implement structured logging middleware with CloudWatch integration
    - Enhance `packages/services/core/src/middleware/logger.ts`
    - Emit StructuredLogEntry for all operations (login, logout, registration, uploads, exercise completion)
    - Configure severity levels: INFO (success), WARN (validation), ERROR (application errors)
    - Log AI Gateway calls: service name, request params, error response, retry count
    - Configure CloudWatch Log Groups: 30-day retention for INFO, 90-day for ERROR
    - Sensitive data masking: passwords never logged, JWT/OTP never logged, emails masked
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

- [ ] 17. Checkpoint — Logging complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Integration and Wiring

  - [ ] 18.1 Wire all frontend screens to backend API endpoints
    - Create API client service in `packages/platform-web/app/src/services/api.ts`
    - Connect Login, Registration, Password Recovery screens to Auth service
    - Connect Dashboard to Progress service (streak, progress percentages)
    - Connect Content Ingestion screens to Content Ingestion service
    - Connect Explanation/Revision/Summary screens to Comprehension service
    - Connect all exercise screens to Content Store + Progress service
    - Connect Pronunciation screen to Pronunciation service
    - Wire Parent Dashboard to Auth service (learners, edit subjects)
    - Handle loading states, error states, retry logic
    - _Requirements: 1.1–1.49, 6.1–6.9, 7.1–7.8, 8.1–8.11, 9.1–9.10, 10.1–10.16, 11.1–11.10, 12.1–12.11, 13.1–13.11, 14.1–14.10, 15.1–15.7, 16.1–16.6, 17.1–17.8, 22.1–22.7_

  - [ ] 18.2 Implement React Native mobile app screens
    - Port key screens to React Native: Login, Dashboard, Content Ingestion, Pronunciation, Grammar, Quiz
    - Implement mobile-specific navigation (Bottom Navigation with 5 tabs)
    - Implement camera capture for Page Upload (native camera API)
    - Implement audio recording for Pronunciation (native microphone API)
    - Apply mobile design tokens (44px bottom nav, full-width, 320-420px viewport)
    - _Requirements: 3.5, 4.1, 4.2, 8.2_

  - [ ]* 18.3 Write integration tests for critical flows
    - Test auth flow: register parent → register student → login → dashboard
    - Test content ingestion: upload pages → OCR → transcript → save
    - Test exercise flow: start quiz → answer questions → score calculation
    - Test AI caching: generate explanation → re-request → verify cached response
    - _Requirements: All_

- [ ] 19. Final Checkpoint — All tests pass, integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between phases
- Property tests validate universal correctness properties from the design (31 total)
- Unit tests validate specific examples and edge cases
- All code is TypeScript: AWS CDK, Node.js Lambda handlers, React web, React Native mobile
- PostgreSQL with pgvector for all data storage (NOT DynamoDB)
- AI Gateway implements generate-once-store-permanently pattern for cost optimization
- Vitest + fast-check for testing (already configured in workspace)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6"] },
    { "id": 3, "tasks": ["3.1", "3.2", "5.1"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.6", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["3.5", "3.7", "3.9", "3.11", "5.5"] },
    { "id": 6, "tasks": ["3.8", "3.10", "3.12", "3.13", "3.15"] },
    { "id": 7, "tasks": ["3.14", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "6.6"] },
    { "id": 9, "tasks": ["6.4", "6.5", "8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3", "8.5"] },
    { "id": 11, "tasks": ["8.4", "8.6", "8.7", "8.10"] },
    { "id": 12, "tasks": ["8.8", "8.9", "10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7"] },
    { "id": 14, "tasks": ["10.8", "10.10", "10.11"] },
    { "id": 15, "tasks": ["10.9", "10.12", "12.1", "12.6", "12.9"] },
    { "id": 16, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.7", "12.8", "12.10", "12.11", "12.12"] },
    { "id": 17, "tasks": ["12.13", "12.14", "12.15", "12.16", "12.17", "12.18"] },
    { "id": 18, "tasks": ["14.1", "14.4", "14.5", "14.7"] },
    { "id": 19, "tasks": ["14.2", "14.3", "14.6", "14.8", "16.1"] },
    { "id": 20, "tasks": ["18.1", "18.2"] },
    { "id": 21, "tasks": ["18.3"] }
  ]
}
```
