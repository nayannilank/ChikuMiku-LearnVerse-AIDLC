# Requirements Document

## Introduction

This feature replaces all stubbed/unimplemented functional flows in the ChikuMiku LearnVerse application with working implementations. The stubs span five domains: authentication and accounts, content management, revision and assessment, sync and offline support, and web platform capabilities. Each stub currently returns empty or placeholder responses (or throws "Not implemented"); this work wires them to real business logic and browser APIs.

## Glossary

- **API_Handler**: A function in `packages/services/api/src/` that receives an HTTP request and returns a response. Dispatched by the ApiRouter.
- **Service_Auth**: The `@learnverse/service-auth` package providing registration, login, session, and lockout logic.
- **Learner_Store**: The in-memory Map in `session.ts` that holds `Learner` records, keyed by ID and looked up by `contactValue`.
- **Parent_Account_Store**: The in-memory Map in `registration.ts` that holds `ParentAccount` records.
- **Student_Account_Store**: The in-memory Map in `registration.ts` that holds `StudentAccount` records.
- **JWT**: JSON Web Token used for authentication. Currently a random 64-char string; to be upgraded to cryptographically signed tokens.
- **Reset_Token**: A one-time-use, time-limited token issued for password reset flows.
- **Notification_Service**: An abstraction that delivers messages (email or SMS) to a parent's registered contact.
- **Content_Store**: The `@learnverse/service-content-store` package managing chapters, progress, and textbooks.
- **Revision_Engine**: Logic that generates questions, scores answers, and tracks performance within a revision session.
- **Sync_Engine**: The `@learnverse/service-sync` package managing offline queues, conflict resolution, and state reconciliation.
- **Web_Platform_Provider**: The `createWebPlatformProvider()` factory in `packages/platform-web/app/src/index.ts` that assembles browser-based adapters.
- **MediaDevices_API**: The browser `navigator.mediaDevices` API for camera and microphone access.
- **File_System_Access_API**: The browser File System Access API (or IndexedDB fallback) for file operations.
- **Web_Audio_API**: The browser Web Audio API and MediaRecorder API for audio recording and playback.
- **Notification_API**: The browser `Notification` API and Push API for displaying notifications.
- **IndexedDB**: A browser-based key-value/object store used for persistent device storage.

## Requirements

### Requirement 1: Parent Registration Persistence

**User Story:** As a parent, I want my registration to be persisted so that I can log in after creating my account.

#### Acceptance Criteria

1. WHEN a valid parent registration request is received, THE API_Handler SHALL call `registerParent()` from Service_Auth and persist the account in Parent_Account_Store
2. WHEN `registerParent()` returns validation errors, THE API_Handler SHALL return HTTP 400 with field-specific error messages
3. WHEN `registerParent()` detects a duplicate username, email, or phone, THE API_Handler SHALL return HTTP 409 with a conflict error message
4. WHEN registration succeeds, THE API_Handler SHALL return HTTP 201 with a confirmation message and the registered username

### Requirement 2: Student Registration with Parent Linking

**User Story:** As a student, I want my registration to be linked to my parent's account so that my parent can manage my learning.

#### Acceptance Criteria

1. WHEN a valid student registration request is received, THE API_Handler SHALL call `registerStudent()` from Service_Auth to persist the account and link it to the parent
2. WHEN `registerStudent()` succeeds, THE API_Handler SHALL add a Learner record to the Learner_Store with `contactValue` set to the student's username
3. WHEN the parent username does not exist in Parent_Account_Store, THE API_Handler SHALL return HTTP 400 with a field error for `parentUsername`
4. WHEN registration succeeds, THE API_Handler SHALL return HTTP 201 with session tokens (auto-login) so the student is immediately authenticated
5. IF `registerStudent()` returns a duplicate username error, THEN THE API_Handler SHALL return HTTP 409 with a conflict error

### Requirement 3: Forgot Password with Notification Delivery

**User Story:** As a parent or student, I want to receive a password reset link so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a forgot-password request is received with a valid username (parent or student), THE API_Handler SHALL generate a Reset_Token with a 1-hour expiry and store it
2. WHEN the username maps to a registered parent, THE Notification_Service SHALL send the reset link to the parent's registered email or phone
3. WHEN the username maps to a registered student, THE Notification_Service SHALL resolve the linked parent account and send the reset link to that parent's registered email or phone
4. THE API_Handler SHALL return HTTP 200 regardless of whether the username exists to prevent username enumeration
5. IF the Notification_Service fails to deliver, THEN THE API_Handler SHALL log the failure but still return HTTP 200 to the client

### Requirement 4: Password Reset Token Verification

**User Story:** As a parent, I want to set a new password using my reset token so that I can regain account access.

#### Acceptance Criteria

1. WHEN a reset-password request is received with a valid, non-expired Reset_Token, THE API_Handler SHALL update the account's password hash
2. WHEN a reset-password request is received with an expired Reset_Token, THE API_Handler SHALL return HTTP 400 with an expiry error
3. WHEN a reset-password request is received with an invalid Reset_Token, THE API_Handler SHALL return HTTP 400 with an invalid-token error
4. WHEN the password is successfully reset, THE API_Handler SHALL invalidate the used Reset_Token so it cannot be reused
5. THE API_Handler SHALL validate the new password against the same rules used during registration (8-20 chars, uppercase, lowercase, digit, special character)

### Requirement 5: JWT Token Refresh

**User Story:** As an authenticated user, I want my session to be silently refreshed so that I do not get logged out unexpectedly.

#### Acceptance Criteria

1. WHEN a valid refresh token is provided, THE API_Handler SHALL issue a new access token and refresh token pair
2. WHEN a refresh token is expired or invalid, THE API_Handler SHALL return HTTP 401 requiring re-authentication
3. THE API_Handler SHALL invalidate the old refresh token after a successful refresh to prevent token reuse
4. WHEN a new token pair is issued, THE API_Handler SHALL set the access token expiry to a minimum of 30 days

### Requirement 6: JWT Signature Verification

**User Story:** As a system operator, I want tokens to be cryptographically verified so that forged tokens are rejected.

#### Acceptance Criteria

1. THE ApiRouter SHALL verify the cryptographic signature of every JWT token presented in the Authorization header
2. WHEN a token has an invalid signature, THE ApiRouter SHALL return HTTP 401 with an "Invalid token" error
3. WHEN a token has been tampered with, THE ApiRouter SHALL reject the request before reaching the route handler
4. THE ApiRouter SHALL use HMAC-SHA256 or equivalent algorithm for signature verification

### Requirement 7: Session Expiry Enforcement

**User Story:** As a system operator, I want expired tokens to be rejected server-side so that stale sessions cannot access protected resources.

#### Acceptance Criteria

1. WHEN an access token's `exp` claim is in the past, THE ApiRouter SHALL return HTTP 401 with a "Token expired" error
2. THE ApiRouter SHALL check the expiry of every token before dispatching to the route handler
3. WHEN a token is rejected as expired, THE API_Handler SHALL include a `suggestedAction` of "Please refresh your token or log in again"

### Requirement 8: Create Chapter from Uploaded Content

**User Story:** As a learner, I want to create a chapter by uploading content so that I can study from my own materials.

#### Acceptance Criteria

1. WHEN a valid chapter creation request is received at `POST /api/v1/chapters`, THE API_Handler SHALL persist the chapter in Content_Store and return a generated chapter ID
2. WHEN required fields are missing from the request body, THE API_Handler SHALL return HTTP 400 with validation errors
3. WHEN the chapter is successfully created, THE API_Handler SHALL return HTTP 201 with the new chapter ID

### Requirement 9: Retrieve Chapter by ID

**User Story:** As a learner, I want to retrieve a specific chapter's details so that I can view its content and pages.

#### Acceptance Criteria

1. WHEN a valid chapter ID is provided in `GET /api/v1/chapters/:chapterId`, THE API_Handler SHALL return the full chapter object from Content_Store
2. WHEN the chapter ID does not exist, THE API_Handler SHALL return HTTP 404 with a "Chapter not found" error
3. THE API_Handler SHALL return the chapter name, page count, creation date, and associated textbook ID

### Requirement 10: List Chapters for a Subject (Legacy Route)

**User Story:** As a learner, I want to list all chapters for a subject so that I can browse available study material.

#### Acceptance Criteria

1. WHEN `GET /api/v1/subjects/:subjectId/chapters` is called, THE API_Handler SHALL return a paginated list of chapters from Content_Store filtered by the subject
2. WHEN no chapters exist for the subject, THE API_Handler SHALL return an empty data array with pagination metadata showing zero total items
3. THE API_Handler SHALL support `page` and `pageSize` query parameters with defaults of page 1 and pageSize 20

### Requirement 11: Get Learner Progress

**User Story:** As a learner, I want to view my progress summary so that I can understand my learning achievements.

#### Acceptance Criteria

1. WHEN `GET /api/v1/progress` is called with a valid token, THE API_Handler SHALL return the authenticated learner's progress records from Content_Store
2. THE API_Handler SHALL include completion percentages, activity scores, and weak activity identification (below 60%) in the response
3. WHEN no progress records exist for the learner, THE API_Handler SHALL return an empty progress object with zero completion

### Requirement 12: Update Progress for Activities

**User Story:** As a learner, I want my activity scores to be recorded so that my progress is tracked accurately.

#### Acceptance Criteria

1. WHEN `POST /api/v1/progress` is called with a valid activity score payload, THE API_Handler SHALL persist the progress update in Content_Store
2. WHEN required fields (chapterId, activityType, score) are missing, THE API_Handler SHALL return HTTP 400 with validation errors
3. WHEN the progress update is successful, THE API_Handler SHALL return HTTP 200 with the updated progress summary
4. THE API_Handler SHALL recalculate the chapter completion percentage after each activity update

### Requirement 13: Start Revision Session

**User Story:** As a learner, I want to start a revision session so that I can practice questions from my studied chapters.

#### Acceptance Criteria

1. WHEN `POST /api/v1/revision/sessions` is called with a chapter ID, THE Revision_Engine SHALL generate 5-20 questions and return a session ID
2. THE Revision_Engine SHALL distribute questions across recall, understanding, and application categories
3. WHEN the chapter has insufficient content for question generation, THE API_Handler SHALL return HTTP 400 with an explanatory message
4. WHEN the session is created, THE API_Handler SHALL return HTTP 201 with the session ID and question count

### Requirement 14: Submit Answer in Revision Session

**User Story:** As a learner, I want to submit answers during my revision session so that my performance is tracked.

#### Acceptance Criteria

1. WHEN `POST /api/v1/revision/sessions/:sessionId/answers` is called with an answer, THE Revision_Engine SHALL evaluate the answer and record the score
2. WHEN the session ID does not exist, THE API_Handler SHALL return HTTP 404
3. WHEN the answer is successfully evaluated, THE API_Handler SHALL return the score, correctness status, and feedback
4. IF the session has already ended, THEN THE API_Handler SHALL return HTTP 400 with a "Session already completed" error

### Requirement 15: Get Revision Session Performance Summary

**User Story:** As a learner, I want to see my revision session results so that I can identify areas needing improvement.

#### Acceptance Criteria

1. WHEN `GET /api/v1/revision/sessions/:sessionId/summary` is called, THE API_Handler SHALL return the session's overall score, per-question results, and weak area identification
2. WHEN the session ID does not exist, THE API_Handler SHALL return HTTP 404
3. THE API_Handler SHALL include the total questions, correct answers, percentage score, and time taken in the summary

### Requirement 16: Push Local Changes to Server (Sync)

**User Story:** As a learner, I want my offline changes to be uploaded when I reconnect so that my progress is preserved across devices.

#### Acceptance Criteria

1. WHEN `POST /api/v1/sync/push` is called with queued actions, THE Sync_Engine SHALL process each action and return arrays of synced, conflicted, and failed items
2. THE Sync_Engine SHALL apply most-recent-wins conflict resolution for conflicting changes
3. WHEN all actions succeed, THE API_Handler SHALL return an empty conflicts array and empty failed array
4. WHEN a conflict is detected, THE Sync_Engine SHALL include the conflicting item in the conflicts array with the server's current version

### Requirement 17: Pull Remote Changes Since Last Sync

**User Story:** As a learner, I want to download changes made on other devices so that my content stays up to date.

#### Acceptance Criteria

1. WHEN `GET /api/v1/sync/pull` is called with a `since` timestamp query parameter, THE Sync_Engine SHALL return all changes made after that timestamp
2. WHEN no `since` parameter is provided, THE API_Handler SHALL return all available changes for the authenticated learner
3. THE API_Handler SHALL include change type (create, update, delete), entity type, entity ID, and timestamp for each change

### Requirement 18: Web Camera Implementation

**User Story:** As a web user, I want to use my device camera so that I can capture textbook pages for content upload.

#### Acceptance Criteria

1. WHEN `isAvailable()` is called, THE Web_Platform_Provider SHALL return true if the browser supports MediaDevices_API with video input
2. WHEN `requestPermission()` is called, THE Web_Platform_Provider SHALL invoke `navigator.mediaDevices.getUserMedia({ video: true })` and return the permission result
3. WHEN `capture()` is called with options, THE Web_Platform_Provider SHALL acquire a video stream, capture a frame, and return the image as a CameraCaptureResult
4. IF the user denies camera permission, THEN THE Web_Platform_Provider SHALL set lastError to `PERMISSION_DENIED` and return the error

### Requirement 19: Web File System Implementation

**User Story:** As a web user, I want to pick, read, and write files so that I can import and export learning content.

#### Acceptance Criteria

1. WHEN `pickFiles()` is called, THE Web_Platform_Provider SHALL open the browser file picker using File_System_Access_API (or `<input type="file">` fallback) filtered by accepted types
2. WHEN `readFile()` is called with a path or blob reference, THE Web_Platform_Provider SHALL return the file contents as an ArrayBuffer with metadata
3. WHEN `writeFile()` is called, THE Web_Platform_Provider SHALL use the File_System_Access_API `showSaveFilePicker` (or download link fallback) to persist the data
4. WHEN `getAvailableSpace()` is called, THE Web_Platform_Provider SHALL query `navigator.storage.estimate()` and return available bytes
5. IF File_System_Access_API is not supported, THEN THE Web_Platform_Provider SHALL fall back to IndexedDB for read and write operations

### Requirement 20: Web Push Notifications Implementation

**User Story:** As a web user, I want to receive notifications so that I am reminded about revision sessions and learning streaks.

#### Acceptance Criteria

1. WHEN `getPermissionStatus()` is called, THE Web_Platform_Provider SHALL return the current `Notification.permission` value mapped to the contract's permission type
2. WHEN `requestPermission()` is called, THE Web_Platform_Provider SHALL invoke `Notification.requestPermission()` and return the boolean result
3. WHEN `showLocalNotification()` is called, THE Web_Platform_Provider SHALL create a browser `Notification` instance with the provided title, body, and data
4. IF the browser does not support the Notification_API, THEN THE Web_Platform_Provider SHALL set lastError to `NOT_SUPPORTED` and return false

### Requirement 21: Web Audio Implementation

**User Story:** As a web user, I want to record and play back audio so that I can use pronunciation practice features.

#### Acceptance Criteria

1. WHEN `isMicrophoneAvailable()` is called, THE Web_Platform_Provider SHALL check for MediaDevices_API support with audio input and return availability
2. WHEN `startRecording()` is called, THE Web_Platform_Provider SHALL create a MediaRecorder instance with the specified format and begin capturing audio
3. WHEN `stopRecording()` is called, THE Web_Platform_Provider SHALL stop the MediaRecorder, assemble the recorded chunks, and return an AudioRecordingResult
4. WHEN `playAudio()` is called, THE Web_Platform_Provider SHALL decode the ArrayBuffer using Web_Audio_API's AudioContext and play it with the specified options
5. IF the user denies microphone permission, THEN THE Web_Platform_Provider SHALL set lastError to `MICROPHONE_DENIED` and reject the operation

### Requirement 22: Web Device Storage Implementation

**User Story:** As a web user, I want my session tokens and settings to persist across browser sessions so that I remain logged in.

#### Acceptance Criteria

1. WHEN `setItem()` is called, THE Web_Platform_Provider SHALL store the key-value pair in localStorage
2. WHEN `getItem()` is called, THE Web_Platform_Provider SHALL retrieve the value from localStorage and return it (or null if not found)
3. WHEN `removeItem()` is called, THE Web_Platform_Provider SHALL remove the specified key from localStorage
4. WHEN `clear()` is called, THE Web_Platform_Provider SHALL remove all LearnVerse-prefixed keys from localStorage without affecting other applications' data
5. WHEN `getAllKeys()` is called, THE Web_Platform_Provider SHALL return all LearnVerse-prefixed keys currently stored
6. IF localStorage is unavailable or full, THEN THE Web_Platform_Provider SHALL fall back to IndexedDB for storage operations
