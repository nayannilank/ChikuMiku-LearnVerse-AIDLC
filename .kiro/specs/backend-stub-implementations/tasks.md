# Implementation Plan: Backend Stub Implementations

## Overview

Replace all stubbed/placeholder API handlers and web platform adapters with working implementations across five domains: Authentication & Accounts, Content Management, Revision & Assessment, Sync & Offline, and Web Platform Capabilities. The implementation uses TypeScript throughout, leveraging existing service packages and in-memory stores.

## Tasks

- [x] 1. JWT Module and Auth Infrastructure
  - [x] 1.1 Implement JWT sign/verify module (`packages/services/auth/src/jwt.ts`)
    - Create `JwtConfig` interface with secret, accessTokenExpiry (30 days), refreshTokenExpiry (60 days), issuer, audience
    - Implement `signToken()` using Node.js `crypto.createHmac('sha256', secret)` with base64url encoding
    - Implement `verifyToken()` that checks signature, expiry, issuer, audience and returns `DecodedToken | null`
    - Implement `createTokenPair()` that generates access + refresh tokens for a userId and roles
    - Default secret from `JWT_SECRET` env var; fall back to `crypto.randomBytes(32)` at startup
    - Export `getJwtConfig()` helper for use by handlers
    - _Requirements: 5.4, 6.1, 6.4, 7.1_

  - [x] 1.2 Implement Reset Token Store (`packages/services/auth/src/resetToken.ts`)
    - Create `ResetTokenEntry` interface with token, username, accountType, expiresAt, used fields
    - Implement `generateResetToken(username, accountType)` using `crypto.randomBytes(32).toString('hex')` with 1-hour TTL
    - Implement `validateResetToken(token)` returning entry if valid and not expired/used, else null
    - Implement `consumeResetToken(token)` marking it as used (returns boolean)
    - Implement `clearResetTokenStore()` for test isolation
    - _Requirements: 3.1, 4.2, 4.3, 4.4_

  - [x] 1.3 Implement Notification Channel (`packages/services/auth/src/notifications.ts`)
    - Define `NotificationChannel` interface with `sendEmail(to, subject, body)` and `sendSms(to, message)`
    - Implement `ConsoleNotificationChannel` that logs to console and returns true
    - Export singleton `notificationService` for use by handlers
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 1.4 Write property tests for JWT module (`packages/services/auth/src/__tests__/jwt.property.test.ts`)
    - **Property 16: Access token minimum 30-day expiry**
    - **Property 17: Forged JWT tokens are rejected**
    - **Validates: Requirements 5.4, 6.1, 6.2, 6.3**

  - [x] 1.5 Write property tests for Reset Token Store (`packages/services/auth/src/__tests__/resetToken.property.test.ts`)
    - **Property 8: Reset token generation for valid username**
    - **Property 10: Invalid reset tokens are rejected**
    - **Property 11: Reset token single-use enforcement**
    - **Validates: Requirements 3.1, 4.3, 4.4**

- [x] 2. Authentication Handlers — Registration
  - [x] 2.1 Wire `handleRegisterParent` to `registerParent()` in `packages/services/api/src/authHandlers.ts`
    - Replace the placeholder success response with a call to `registerParent()` from `@learnverse/service-auth`
    - On success: return HTTP 201 with `{ message, username }`
    - On validation errors: return HTTP 400 with field-specific errors array
    - On duplicate (username, email, or phone): return HTTP 409 with conflict error
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Wire `handleRegisterStudent` to `registerStudent()` with parent linking and auto-login
    - Replace the placeholder response with a call to `registerStudent()` from `@learnverse/service-auth`
    - After successful registration, add a Learner record to the learner store with `contactValue` = student username
    - Generate a JWT token pair via `createTokenPair()` for auto-login
    - Link the student to the parent via `linkedStudentIds`
    - On non-existent parent username: return HTTP 400 with field error for `parentUsername`
    - On duplicate student username: return HTTP 409
    - On success: return HTTP 201 with `{ message, username, accessToken, refreshToken, expiresAt, tokenType }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Write property tests for registration handlers (`packages/services/api/src/__tests__/authHandlers.property.test.ts`)
    - **Property 1: Parent registration round-trip**
    - **Property 2: Parent registration rejects invalid input**
    - **Property 3: Parent registration detects duplicates**
    - **Property 4: Student registration persists, links, and auto-authenticates**
    - **Property 5: Student registration rejects non-existent parent**
    - **Property 6: Student registration detects duplicate username**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 3. Authentication Handlers — Password Recovery and Token Refresh
  - [x] 3.1 Implement forgot-password handler with reset token generation and notification
    - Update `handleForgotPassword` in `authHandlers.ts` to look up username in both `parentAccountStore` and `studentAccountStore`
    - If found: call `generateResetToken()` and send notification via `NotificationChannel`
    - For students: resolve linked parent account and send to parent's contact
    - Always return HTTP 200 regardless of account existence or notification failure
    - Log notification failures without surfacing them
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Implement reset-password handler (`handleResetPassword` in `authHandlers.ts`)
    - Register new route `POST /api/v1/auth/reset-password` in `endpoints.ts`
    - Validate the new password against registration rules (8-20 chars, uppercase, lowercase, digit, special)
    - Call `validateResetToken(token)` — if null, return HTTP 400 (invalid/expired)
    - On valid token: update the account's password hash in the appropriate store (parent or student)
    - Call `consumeResetToken(token)` to prevent reuse
    - Return HTTP 200 on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.3 Implement token refresh handler (`handleRefresh` in `authHandlers.ts`)
    - Replace the stub inline handler in `endpoints.ts` with a real implementation
    - Verify the refresh token via `verifyToken()` — must be type 'refresh' and not expired
    - Check that the refresh token is not revoked (maintain a revoked token set)
    - Revoke the old refresh token after successful exchange
    - Issue a new token pair via `createTokenPair()` with minimum 30-day access token expiry
    - Return HTTP 401 for invalid/expired/revoked refresh tokens
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.4 Upgrade `ApiRouter.validateAuth` to use JWT signature verification
    - Replace the stub auth check in `endpoints.ts` `ApiRouter.validateAuth()` with real JWT verification
    - Call `verifyToken(token, config)` to validate signature and expiry
    - On invalid signature: return HTTP 401 with "Invalid token" before reaching handler
    - On expired token: return HTTP 401 with "Token expired" and `suggestedAction`
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_

  - [x] 3.5 Write property tests for password recovery and refresh (`packages/services/api/src/__tests__/authHandlers.property.test.ts`)
    - **Property 7: Forgot-password always returns 200**
    - **Property 9: Password reset updates hash**
    - **Property 12: Reset password validates new password**
    - **Property 13: Token refresh issues new pair**
    - **Property 14: Invalid refresh tokens return 401**
    - **Property 15: Refresh token single-use enforcement**
    - **Property 18: Expired JWT tokens are rejected**
    - **Validates: Requirements 3.4, 3.5, 4.1, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 7.1, 7.2**

- [x] 4. Checkpoint — Auth domain complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Content Management Handlers
  - [x] 5.1 Implement standalone chapter CRUD handler (`POST /api/v1/chapters`)
    - Replace the inline stub in `endpoints.ts` with a real handler function in `contentHandlers.ts`
    - Validate required fields: name (1-200 chars), textbookId, subjectId
    - Persist the chapter in the chapter store with auto-generated ID
    - Return HTTP 201 with `{ id, message }` on success
    - Return HTTP 400 with field-specific validation errors on failure
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.2 Implement get-chapter-by-ID handler (`GET /api/v1/chapters/:chapterId`)
    - Replace the inline stub in `endpoints.ts` with a real handler in `contentHandlers.ts`
    - Extract `chapterId` from path parameter
    - Look up chapter in the chapter store
    - Return HTTP 200 with chapter object (name, page count, creation date, textbookId) on success
    - Return HTTP 404 with "Chapter not found" error if not found
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 5.3 Implement list-subject-chapters handler (`GET /api/v1/subjects/:subjectId/chapters`)
    - Replace the inline stub in `endpoints.ts` with a real handler in `contentHandlers.ts`
    - Extract subjectId from path, page/pageSize from query params (defaults: page=1, pageSize=20)
    - Filter chapters by subjectId from the chapter store
    - Return paginated response with `{ data, pagination: { page, pageSize, totalItems, totalPages } }`
    - Return empty data array with zero totals when no chapters exist
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 5.4 Write property tests for content handlers (`packages/services/api/src/__tests__/contentHandlers.property.test.ts`)
    - **Property 19: Chapter creation and retrieval round-trip**
    - **Property 20: Chapter creation rejects invalid input**
    - **Property 21: Non-existent chapter returns 404**
    - **Property 22: Subject chapters are filtered correctly with pagination**
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 10.1, 10.3**

- [x] 6. Progress Handlers
  - [x] 6.1 Implement progress handlers (`packages/services/api/src/progressHandlers.ts`)
    - Create `handleGetProgress` — extract learnerId from JWT, query `ContentStore.getProgress()`, include weak activities (< 60%)
    - Create `handleUpdateProgress` — validate body (chapterId, activityType, score 0-100), call `ContentStore.trackProgress()`, return updated summary with recalculated completion percentage
    - Replace the inline stubs in `endpoints.ts` with these handlers
    - Return HTTP 400 with validation errors for missing/invalid fields
    - Return empty progress object with zero completion when no records exist
    - _Requirements: 11.1, 11.2, 12.1, 12.2, 12.3, 12.4_

  - [x] 6.2 Write property tests for progress handlers (`packages/services/api/src/__tests__/progressHandlers.property.test.ts`)
    - **Property 23: Progress update round-trip**
    - **Property 24: Completion percentage recalculation**
    - **Property 25: Progress rejects invalid input**
    - **Property 26: Weak activity identification**
    - **Validates: Requirements 11.1, 11.2, 12.1, 12.2, 12.3, 12.4**

- [x] 7. Checkpoint — Content domain complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Revision Engine and Handlers
  - [x] 8.1 Implement RevisionEngine (`packages/services/content-store/src/revisionEngine.ts`)
    - Create `RevisionSession`, `RevisionQuestion`, `RevisionAnswer`, `RevisionSummary` interfaces
    - Implement `startRevisionSession(learnerId, chapterId)` — generate 5-20 questions distributed across recall/understanding/application categories; return null if insufficient content
    - Implement `submitAnswer(sessionId, questionId, answer)` — score the answer (0-100), generate feedback, record in session; return null if session not found; reject if session is completed
    - Implement `getSessionSummary(sessionId)` — compute percentageScore, timeTakenMs, weakAreas, perQuestionResults; return null if session not found
    - Store sessions in an in-memory Map<string, RevisionSession>
    - Export `clearRevisionStore()` for test isolation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3_

  - [x] 8.2 Implement revision API handlers (`packages/services/api/src/revisionHandlers.ts`)
    - Create `handleStartRevision` — extract learnerId from JWT and chapterId from body; call `startRevisionSession()`; return HTTP 201 with `{ sessionId, questionCount }` or HTTP 400 if insufficient content
    - Create `handleSubmitAnswer` — extract sessionId from path and answer from body; call `submitAnswer()`; return score, correctness, feedback or HTTP 404/400
    - Create `handleGetRevisionSummary` — extract sessionId from path; call `getSessionSummary()`; return summary or HTTP 404
    - Replace the inline stubs in `endpoints.ts` with these handlers
    - _Requirements: 13.1, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3_

  - [x] 8.3 Write property tests for revision engine (`packages/services/content-store/src/__tests__/revisionEngine.property.test.ts`)
    - **Property 27: Revision session question count bounds**
    - **Property 28: Revision question category distribution**
    - **Property 29: Answer submission produces score**
    - **Property 30: Answer to non-existent session returns 404**
    - **Property 31: Completed session rejects new answers**
    - **Property 32: Session summary computation**
    - **Validates: Requirements 13.1, 13.2, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.3**

- [x] 9. Sync Handlers
  - [x] 9.1 Implement sync API handlers (`packages/services/api/src/syncHandlers.ts`)
    - Create `handleSyncPush` — deserialize queued actions from body; process each through sync engine with most-recent-wins conflict resolution; return `{ synced, conflicts, failed }` arrays where every action ID appears in exactly one array
    - Create `handleSyncPull` — read `since` query parameter; filter in-memory change log by timestamp and learnerId; return `{ changes }` array with changeType, resourceType, resourceId, timestamp, data
    - Implement in-memory sync server adapter and change log for local dev
    - Replace the inline stubs in `endpoints.ts` with these handlers
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3_

  - [x] 9.2 Write property tests for sync handlers (`packages/services/api/src/__tests__/syncHandlers.property.test.ts`)
    - **Property 33: Sync push categorizes all items exclusively**
    - **Property 34: Sync conflict resolution — most-recent-wins**
    - **Property 35: Sync pull filters by timestamp**
    - **Property 36: Sync pull change objects have required fields**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 17.1, 17.3**

- [x] 10. Checkpoint — Revision & Sync domains complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Web Platform — Device Storage
  - [x] 11.1 Implement WebStorage adapter in `packages/platform-web/app/src/index.ts`
    - Replace `WebStorageStub` with a real `WebStorage` class implementing `DeviceStorageInterface`
    - Use `localStorage` with a `learnverse:` key prefix for namespace isolation
    - `setItem(key, value)` → `localStorage.setItem('learnverse:' + key, value)`
    - `getItem(key)` → `localStorage.getItem('learnverse:' + key)` returning value or null
    - `removeItem(key)` → `localStorage.removeItem('learnverse:' + key)`
    - `clear()` → remove only `learnverse:`-prefixed keys from localStorage
    - `getAllKeys()` → return all `learnverse:`-prefixed keys (without the prefix)
    - Fall back to IndexedDB if localStorage is unavailable or throws QuotaExceededError
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

  - [x] 11.2 Write property tests for WebStorage (`packages/platform-web/app/src/__tests__/webStorage.property.test.ts`)
    - **Property 37: Device storage CRUD round-trip**
    - **Property 38: Device storage prefix isolation**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5**

- [x] 12. Web Platform — Camera, FileSystem, Audio, Notifications
  - [x] 12.1 Implement WebCamera adapter in `packages/platform-web/app/src/index.ts`
    - Replace `WebCameraStub` with a real `WebCamera` class
    - `isAvailable()` → check `navigator.mediaDevices?.getUserMedia` and enumerate video input devices
    - `requestPermission()` → call `getUserMedia({ video: true })`, stop tracks on success
    - `capture(options)` → acquire video stream, draw frame to canvas, export as blob, return `CameraCaptureResult`
    - On permission denial: set `lastError` to `PERMISSION_DENIED`, return error
    - On API unavailability: set `lastError` to `CAMERA_UNAVAILABLE`, return false from `isAvailable()`
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 12.2 Implement WebFileSystem adapter in `packages/platform-web/app/src/index.ts`
    - Replace `WebFileSystemStub` with a real `WebFileSystem` class
    - `pickFiles(options)` → use `showOpenFilePicker` with accept filters; fall back to hidden `<input type="file">`
    - `readFile(path)` → read file handle or blob as ArrayBuffer; return with metadata
    - `writeFile(path, data, mimeType)` → use `showSaveFilePicker`; fall back to download link
    - `getAvailableSpace()` → use `navigator.storage.estimate()` returning available bytes
    - Fall back to IndexedDB for read/write when File System Access API is unsupported
    - Set `lastError` on failure with appropriate error codes
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 12.3 Implement WebNotifications adapter in `packages/platform-web/app/src/index.ts`
    - Replace `WebNotificationStub` with a real `WebNotifications` class
    - `getPermissionStatus()` → map `Notification.permission` ('granted'/'denied'/'default') to contract types
    - `requestPermission()` → call `Notification.requestPermission()` and return boolean
    - `showLocalNotification(payload)` → create `new Notification(title, { body, data })`; return true
    - If `Notification` API is not supported: set `lastError` to `NOT_SUPPORTED`, return false
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 12.4 Implement WebAudio adapter in `packages/platform-web/app/src/index.ts`
    - Replace `WebAudioStub` with a real `WebAudio` class
    - `isMicrophoneAvailable()` → check `navigator.mediaDevices` with audio input enumeration
    - `startRecording(options)` → get audio stream, create `MediaRecorder`, collect chunks in array
    - `stopRecording()` → stop MediaRecorder, assemble Blob from chunks, return `AudioRecordingResult`
    - `playAudio(data, options)` → create `AudioContext`, decode ArrayBuffer, play via AudioBufferSourceNode
    - On microphone permission denial: set `lastError` to `MICROPHONE_DENIED`
    - On API unavailability: set `lastError` to `MICROPHONE_UNAVAILABLE`
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [x] 12.5 Write unit tests for WebCamera (`packages/platform-web/app/src/__tests__/webCamera.test.ts`)
    - Mock `navigator.mediaDevices` and test permission flow, capture flow, and error handling
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 12.6 Write unit tests for WebFileSystem (`packages/platform-web/app/src/__tests__/webFileSystem.test.ts`)
    - Mock File System Access API and test pick, read, write, and IndexedDB fallback
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 12.7 Write unit tests for WebNotifications (`packages/platform-web/app/src/__tests__/webNotifications.test.ts`)
    - Mock `Notification` constructor and permission API; test all flows
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 12.8 Write unit tests for WebAudio (`packages/platform-web/app/src/__tests__/webAudio.test.ts`)
    - Mock `MediaRecorder`, `AudioContext`, and `getUserMedia`; test recording and playback
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [x] 13. Login Handler Enhancement — Username Lookup in Account Stores
  - [x] 13.1 Update `handleLogin` to search parent/student account stores
    - After `findLearnerByContact(username)` returns undefined, also search `parentAccountStore` and `studentAccountStore` by username
    - If a parent/student account is found, verify password against that account's hash
    - On success: create JWT token pair and return session tokens
    - Maintain existing lockout and error handling behavior
    - _Requirements: 2.4, 5.1_

- [x] 14. Final Checkpoint — All domains complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation across domain boundaries
- Property tests validate universal correctness properties from the design document (38 total)
- Unit tests (with mocks) cover web platform adapters that interact with browser APIs
- All implementations use in-memory stores consistent with the existing project architecture
- The JWT module uses HMAC-SHA256 via Node.js `crypto` — no external dependencies needed
- Web platform adapters are all implemented in the single `index.ts` file per the design decision

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "2.1", "2.2", "5.1", "5.2", "5.3", "11.1"] },
    { "id": 2, "tasks": ["2.3", "3.1", "3.2", "3.3", "5.4", "6.1", "11.2"] },
    { "id": 3, "tasks": ["3.4", "3.5", "6.2", "8.1", "9.1", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 4, "tasks": ["8.2", "8.3", "9.2", "12.5", "12.6", "12.7", "12.8", "13.1"] }
  ]
}
```
