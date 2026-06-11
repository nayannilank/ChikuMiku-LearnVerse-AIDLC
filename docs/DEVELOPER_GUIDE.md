# ChikuMiku LearnVerse — Developer Guide

## Introduction

ChikuMiku LearnVerse is a multi-subject learning platform for children built as a TypeScript monorepo with a layered architecture. This guide covers the project structure, development workflow, architecture, and conventions for contributors.

## Tech Stack

| Category | Technology | Version / Notes |
|----------|-----------|-----------------|
| **Language & Runtime** | TypeScript | 5.6 (strict mode) |
| | Node.js | 22+ |
| **Monorepo** | npm workspaces | Layered architecture with dependency boundaries |
| **Build** | `tsc --build` | Project references for incremental compilation |
| | Vite | Web dev server with HMR |
| | `marked` | Markdown → HTML (User Guide build step) |
| | `tsx` | TypeScript script execution |
| **Testing** | Vitest | 2.1 — test runner |
| | fast-check | 3.22 — property-based testing |
| | happy-dom | Lightweight DOM for component tests |
| **Linting** | ESLint | 8.57 with `@typescript-eslint` |
| **Web Platform** | Vite | Dev server and bundler |
| | Browser APIs | Camera, FileSystem, Audio, Notifications |
| **Mobile Platform** | React Native | 0.74, Android (API 26+) |
| | React Navigation | 6 — Native stack navigator |
| | Metro | Bundler for React Native |
| **Backend** | Serverless Framework | AWS Lambda + API Gateway emulation via `serverless-offline` |
| | JWT | Authentication tokens (30-day minimum validity) |
| **Infrastructure** | AWS Lambda + API Gateway | Production compute |
| | DynamoDB | Database (local emulation for dev) |
| | Tiered Storage | Hot (30-day) / Cold archival |

## Prerequisites

- Node.js 22+
- npm 9+
- Git

## Getting Started

```bash
# Clone the repository
git clone <repository-url>
cd "ChikuMiku LearnVerse"

# Install dependencies
npm install

# Build all packages (includes User Guide HTML generation)
npm run build

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint all packages
npm run lint

# Validate package naming conventions
npm run validate:naming

# Validate dependency boundaries
npm run validate:boundaries

# Run all validators
npm run validate
```

## Running Locally

### Prerequisites for Local Development

In addition to the base prerequisites, you'll need:

- **Web**: No extra tools — Vite is included as a dev dependency
- **Mobile**: Android Studio (latest stable), JDK 17+, Android SDK (API 26+), React Native CLI
- **Backend**: `tsx` (installed as a dev dependency) for running the local API server

### Running the Web App

The web app uses Vite as its dev server. From the project root:

```bash
# Build shared packages first (required on first run or after service changes)
npm run build

# Start the Vite dev server
cd packages/platform-web/app
npx vite

# Or if a dev script is configured:
npm run dev --workspace=@learnverse/web-app
```

The dev server starts at `http://localhost:5173` by default. It supports hot module replacement (HMR) — changes to web platform packages and UI components reflect instantly in the browser.

**Environment variables**: Create a `.env.local` file in `packages/platform-web/app/` for local overrides (API URL, etc.):

```bash
VITE_API_URL=http://localhost:3000
```

### Running the Backend Locally

The API service includes a built-in local development server using Node.js `http` module:

```bash
# Build all service packages first
npm run build

# Start the local API server
npx tsx packages/services/api/src/server.ts
```

This starts a local HTTP server at `http://localhost:3000` with all API endpoints available, CORS headers configured, and request logging to stdout.

**Tips**:
- Set `PORT=<number>` to use a different port: `PORT=4000 npx tsx packages/services/api/src/server.ts`
- Set `NODE_ENV=development` for verbose logging
- Rebuild service packages (`npm run build`) after making changes, then restart the server
- DynamoDB Local or a local Docker instance can be used for database emulation

### Running the Mobile App (Android)

The mobile app is built with React Native. To run it on an Android emulator or physical device:

```bash
# 1. Build shared packages
npm run build

# 2. Install mobile dependencies (if not already done)
cd packages/platform-mobile/rn-app
npm install

# 3. Start the Metro bundler
npx react-native start

# 4. In a separate terminal, build and run on Android
npx react-native run-android
```

**Using Android Studio**:

1. Open Android Studio
2. Select **Open an Existing Project** and navigate to `packages/platform-mobile/rn-app/android/`
3. Let Gradle sync complete
4. Select your target device (emulator or connected device via USB debugging)
5. Click **Run** (green play button) or press `Shift+F10`

**Requirements**:
- Android SDK API level 26+ (Android 8.0) — matches the minimum supported version
- An emulator with Google Play Services or a physical device with USB debugging enabled
- `ANDROID_HOME` environment variable set to your Android SDK path

**Common issues**:
- If Metro bundler can't find packages, run `npm run build` from the project root first
- For native module linking issues, run `cd android && ./gradlew clean` then rebuild
- Ensure the emulator/device and your machine are on the same network for live reload

### Running All Three Together

For full-stack local development:

```bash
# Terminal 1: Backend API
npx tsx packages/services/api/src/server.ts

# Terminal 2: Web app (points to local backend)
cd packages/platform-web/app && npx vite

# Terminal 3: Mobile Metro bundler (points to local backend)
cd packages/platform-mobile/rn-app && npx react-native start
```

Set the API URL in both clients to `http://localhost:3000` (or your machine's local IP for the Android emulator — typically `http://10.0.2.2:3000`).

## Project Structure

```
ChikuMiku LearnVerse/
├── packages/
│   ├── core/                        # Shared cross-cutting features (help button)
│   │   └── src/helpButton/          # In-app help button & User Guide viewer
│   ├── services/                    # Platform-agnostic domain logic
│   │   ├── core/                    # Shared data models, types, validation, Subject Module registry
│   │   ├── auth/                    # Authentication, registration, session, lockout, parental linking
│   │   ├── content-store/           # Chapter persistence, progress tracking, grade management
│   │   ├── content-ingestion/       # Image upload, text extraction, page management, question extraction
│   │   ├── pronunciation/           # Syllable breakdown, pronunciation scoring, error handling
│   │   ├── grammar/                 # Sentence analysis, exercise generation, scoring
│   │   ├── comprehension/           # Model answers, hints, revision mode, timed tests
│   │   ├── sync/                    # Offline queue, conflict resolution, optimistic updates, state restoration
│   │   └── api/                     # RESTful endpoints, platform interface abstraction
│   ├── platform-contracts/          # Interface definitions shared between services and platforms
│   ├── platform-web/                # Web-specific implementations (browser APIs)
│   │   ├── app/                     # Web platform provider entry point
│   │   ├── camera/                  # Web camera implementation
│   │   ├── filesystem/              # Web file system implementation
│   │   ├── notifications/           # Web notifications implementation
│   │   ├── audio/                   # Web audio implementation
│   │   └── ui/                      # Web UI components
│   └── platform-mobile/             # Mobile-specific implementations (native APIs)
│       ├── app/                     # Mobile platform provider entry point
│       ├── rn-app/                  # React Native app (screens, navigation, components)
│       ├── camera/                  # Mobile camera implementation
│       ├── filesystem/              # Mobile file system implementation
│       ├── notifications/           # Mobile notifications implementation
│       ├── audio/                   # Mobile audio implementation
│       └── ui/                      # Mobile UI components
├── scripts/                         # Build and validation scripts
│   ├── build-user-guide.ts          # Converts USER_GUIDE.md to static HTML
│   ├── validate-naming.ts           # Validates package naming conventions
│   └── validate-boundaries.ts       # Validates dependency boundary rules
├── docs/                            # Documentation (this guide, user guide, deployment guide)
├── .kiro/specs/                     # Spec-driven development artifacts
├── LearnVerse-LearnVerse-Logo.png    # Brand logo asset (used for app icon, splash, nav header, favicon)
├── package.json                     # Root workspace configuration
├── tsconfig.json                    # Root TypeScript project references
├── tsconfig.base.json               # Shared TypeScript compiler options
├── vitest.config.ts                 # Test configuration
└── eslint.config.mjs                # Linting configuration
```

### Mobile App Structure (`packages/platform-mobile/rn-app/`)

The React Native app follows a screen-based architecture with React Navigation 6:

```
rn-app/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx              # React context: token state, auth API calls
│   ├── hooks/
│   │   └── useAuth.ts                   # Exposes login, register, logout, isAuthenticated
│   ├── navigation/
│   │   ├── RootNavigator.tsx            # Conditional: Auth Stack vs Main Stack
│   │   └── routeResolver.ts            # resolveInitialRoute based on token state
│   ├── screens/
│   │   ├── SplashScreen.tsx             # Branded splash, token validation, route decision
│   │   ├── LoginScreen.tsx              # Username/password login with lockout handling
│   │   ├── ParentRegistrationScreen.tsx # Parent account creation form
│   │   ├── StudentRegistrationScreen.tsx# Student registration linked to parent
│   │   ├── TextbookListScreen.tsx       # Lists textbooks for a subject; shows form if empty
│   │   └── ... (existing screens)
│   └── components/
│       ├── TextbookEntryForm.tsx         # Textbook name input (max 200 chars), inline validation
│       ├── ChapterCreationForm.tsx       # Chapter name input (max 200 chars), inline validation
│       ├── PageAdditionUI.tsx            # Camera + gallery buttons in Learning Screen
│       ├── ImagePreview.tsx              # Preview captured/selected image with accept/retake
│       ├── HeaderLogo.tsx               # Logo in navigation bar header
│       └── ... (existing components)
├── android/
│   └── app/src/main/res/               # App icon (generated from LearnVerse-LearnVerse-Logo.png)
└── package.json
```

### Navigation Structure

The app uses a conditional navigation structure based on authentication state:

```typescript
// RootNavigator renders one of these stacks based on token state:

// Auth Stack (no valid token)
type AuthStackParamList = {
  Login: undefined;
  ParentRegistration: undefined;
  StudentRegistration: undefined;
  ForgotPassword: undefined;
};

// Main Stack (valid token present)
type MainStackParamList = {
  SubjectSelection: undefined;
  TextbookList: { subjectId: string };
  ChapterSelection: { subjectId: string; textbookId: string };
  Learning: { subjectId: string; textbookId: string; chapterId: string | null };
};
```

**Route resolution logic** (`routeResolver.ts`):
- No token in device storage → Auth Stack
- Token exists but validation fails (expired/invalid) → Auth Stack with "Session ended" message
- Token exists but network error on validation → Auth Stack with "Connection problem" message
- Token valid → Main Stack (Subject Selection)

## Architecture Overview

The platform follows a **layered architecture** with strict dependency boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│  Platform Web (packages/platform-web/*)                      │
│  @learnverse/web-app, web-camera, web-filesystem, etc.       │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│  Platform Contracts (packages/platform-contracts)             │
│  @learnverse/platform-contracts                               │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│  Services (packages/services/*)                               │
│  @learnverse/service-core, service-auth, service-sync, etc.   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Platform Mobile (packages/platform-mobile/*)                │
│  @learnverse/mobile-app, rn-app, mobile-camera, etc.          │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
App Launch
    │
    ▼
┌────────────┐    token exists?     ┌──────────────────┐
│ SplashScreen├────── yes ──────────►│ GET /auth/validate│
│ (1-5 sec)  │                      └────────┬─────────┘
└──────┬─────┘                               │
       │ no token                    valid?   │
       ▼                            yes ──────┼──► Main Stack (SubjectSelection)
┌────────────┐                               │
│ Auth Stack │◄────────── no / error ────────┘
│  (Login)   │
└──────┬─────┘
       │ login success
       ▼
  Main Stack (SubjectSelection)
```

Mid-session token expiry: API returns 401 → app attempts to save unsaved input → redirect to Auth Stack with "Session ended" message.

### Dependency Rules

| Layer | Can depend on |
|-------|---------------|
| `@learnverse/service-*` | Other service packages, `@learnverse/platform-contracts` |
| `@learnverse/platform-contracts` | `@learnverse/service-core` only |
| `@learnverse/web-*` | `@learnverse/platform-contracts`, any service package |
| `@learnverse/mobile-*` | `@learnverse/platform-contracts`, any service package |

**Forbidden**: Services cannot import from web or mobile packages. Web and mobile packages cannot import from each other.

These boundaries are enforced by the `validate:boundaries` script and checked in CI.

### Pluggable Subject Module Architecture

Within the services layer:

- **Core Platform Services** (auth, content-store, sync) are subject-agnostic
- **Subject-Specific Services** (content-ingestion, pronunciation, grammar, comprehension) delegate to Subject Modules for subject-specific logic
- **Subject Modules** define extraction pipelines, question generation strategies, grammar rules, and pronunciation assets per subject

New subjects (e.g., Tamil, French, Physics) can be added by deploying a new Subject Module without modifying core services.

### Key Design Principles

1. **Auth-First Navigation**: The navigator conditionally renders an auth stack or the main stack based on token presence, using `DeviceStorageInterface` for token persistence.
2. **Offline-First**: Clients cache content locally and queue actions when offline (max 50). Sync happens automatically when connectivity is restored.
3. **Optimistic UI**: Local state updates immediately; rollback occurs if the server rejects the action.
4. **Platform-Agnostic Services**: Business logic is fully separated from platform-specific code via the contracts layer.
5. **Textbook as Intermediate Entity**: Subjects own textbooks; textbooks own chapters. Mirrors physical study material organization.
6. **Tiered Storage**: Hot storage for content accessed within 30 days; cold storage for older content.
7. **Build-Time Content Processing**: The User Guide is converted from Markdown to static HTML at build time — no runtime parsing needed.

## Package Details

### `packages/core`

Cross-cutting features shared across the entire application.

- **Help Button**: Persistent UI element providing access to the in-app User Guide viewer
- **User Guide Viewer**: Displays pre-built static HTML with TOC navigation, offline caching, and state preservation

### `packages/services/core`

Shared types and utilities used across all service packages.

- **Data Models**: `Learner`, `Chapter`, `Page`, `Textbook`, `Question`, `ProgressRecord`, `ActivityScore`, `RevisionSession`, `GradeArchive`, `QueuedAction`
- **Validation**: Grade (1-12), ImageInput (format + size), registration input, content name validation (textbook/chapter: 1-200 chars)
- **Subject Module Registry**: `SubjectModuleRegistry` with `register`, `getModule`, `listModules`
- **Enrollment**: Multi-subject enrollment with isolation (max 10 subjects)

### `packages/services/auth`

Authentication and session management.

- **Registration**: Two account types — Parent and Student
  - **Parent**: Name (max 100), username (5-15, alphanumeric + `_` + `-`), phone (10 digits), email (max 254)
  - **Student**: Name (max 100), username (5-15, alphanumeric + `_` + `-`), password (8-20, uppercase + lowercase + digit + special char), grade (1-12), linked to parent via parent username
- **Login**: Username-based (5-15 chars), password (max 20 chars, masked), 30-second timeout
- **Session**: JWT-based, minimum 30-day validity, stored in device storage
- **Lockout**: 3 consecutive failures → 15-minute lock, submit button disabled during lockout
- **Forgot Password**: Recovery via phone/email registered to linked parent account
- **Parental Linking**: Parent can view progress, reset password, update profile; students always linked to a parent
- **Local Backup**: 7-day retention of progress regardless of session status

### `packages/services/content-store`

Persistent storage and progress tracking.

- **Textbook CRUD**: Create, list textbooks per subject (name: 1-200 chars)
- **Chapter CRUD**: Create, list chapters per textbook (name: 1-200 chars, auto-numbered)
- **Progress Tracking**: Completion percentage, activity scores, weak activity identification (< 60%)
- **Grade Management**: Promotion workflow, archiving (read-only), deletion with confirmation
- **Revision Material**: Subject-type-aware options (language subjects get pronunciation + grammar)

### `packages/services/content-ingestion`

Image processing and content extraction.

- **Image Upload**: JPEG/PNG/HEIC, max 10 MB, compressed to 1 MB before transmission
- **Page Management**: Sequential ordering, max 50 pages per chapter, reordering
- **Text Extraction**: Routed through Subject Module extraction pipelines
- **Question Extraction**: Extract questions from photos, associate with chapters

### `packages/services/pronunciation`

Language pronunciation practice.

- **Syllable Breakdown**: Word → syllables with transliteration
- **Scoring**: 0-100 accuracy with syllable-level feedback
- **Error Handling**: Microphone access, audio playback, graceful degradation for missing assets

### `packages/services/grammar`

Language grammar assistance.

- **Sentence Analysis**: Error identification with grade-appropriate explanations
- **Exercise Generation**: 5-10 exercises from stored chapter vocabulary
- **Scoring**: 0-100 percentage with weak area identification (< 60%)

### `packages/services/comprehension`

Question answering and revision.

- **Model Answers**: Generated from chapter content via Subject Module strategies
- **Answer Evaluation**: Percentage score, missing points, factual errors
- **Hints**: Step-by-step guidance without revealing full answer
- **Revision Mode**: 5-20 questions per chapter, recall/understanding/application distribution
- **Timed Tests**: 5-120 minute configurable limit, auto-end with unattempted marking

### `packages/services/sync`

Cross-platform synchronization.

- **Offline Queue**: Max 50 actions, sequential ordering, replay on reconnect
- **Conflict Resolution**: Most-recent-wins strategy
- **Optimistic Updates**: Immediate local state change with rollback on rejection
- **Platform State Restoration**: Save/restore active subject, chapter, exercise position, unsaved input

### `packages/services/api`

API layer and platform abstraction.

- **RESTful Endpoints**: Platform-independent, JSON payloads, JWT authentication
- **Platform Interface**: Abstract camera, file system, push notifications behind contracts

### API Endpoints

#### Authentication Endpoints (public — no JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login with username + password; returns JWT |
| POST | `/api/v1/auth/register/parent` | Register parent account (name, username, phone, email) |
| POST | `/api/v1/auth/register/student` | Register student account linked to parent username |
| POST | `/api/v1/auth/forgot-password` | Initiate password recovery via parent's phone/email |
| POST | `/api/v1/auth/reset-password` | Reset password using token + new password |
| GET | `/api/v1/auth/validate` | Validate current token (requires Bearer token) |

#### Content Hierarchy Endpoints (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subjects/:subjectId/textbooks` | List textbooks for a subject |
| POST | `/api/v1/subjects/:subjectId/textbooks` | Create a textbook under a subject |
| GET | `/api/v1/textbooks/:textbookId/chapters` | List chapters for a textbook |
| POST | `/api/v1/textbooks/:textbookId/chapters` | Create a chapter under a textbook |
| POST | `/api/v1/chapters/:chapterId/pages` | Upload a page image to a chapter |

### `packages/platform-contracts`

Interface definitions that form the boundary between services and platform implementations.

- **CameraInterface**: Photo capture, permissions
- **FileSystemInterface**: File read/write, picker
- **AudioInterface**: Recording, playback
- **PushNotificationInterface**: Local/remote notifications
- **NavigationInterface**: Route navigation, back navigation
- **DeviceStorageInterface**: Key-value device storage (used for session token persistence)
- **PlatformProvider**: Aggregate interface combining all capabilities
- **PlatformRegistry**: Runtime registry for platform provider lookup

### `packages/platform-web/*`

Browser-based implementations of platform contracts.

- **`web-app`**: Exports `createWebPlatformProvider` — the web entry point
- **`web-camera`**, **`web-filesystem`**, **`web-audio`**, **`web-notifications`**, **`web-ui`**: Individual capability implementations using browser APIs

#### Web App Routing Architecture

The web app (`packages/platform-web/app`) uses a lightweight hash-based router for client-side navigation. The router is defined in `src/router/HashRouter.ts` and wired up in `src/main.ts`.

**Route definitions:**

| Hash | View | Description |
|------|------|-------------|
| `#` (empty) | `HomeView` | Role selector → Login form (with failure actions) |
| `#register` | `RegistrationView` | Role choice → Parent form or Parent login gate → Student form |
| `#forgot-password` | `ForgotPasswordView` | Request password reset link |
| `#reset-password?token=<value>` | `ResetPasswordView` | Set new password using reset token |
| Unknown hash | `HomeView` (fallback) | Any unrecognized hash renders the home page |

**Key components:**

- `HashRouter` — Listens to `hashchange` events, matches regex patterns against the hash, renders the matched view into a single mount point
- `RoleSelector` — Radio buttons (Parent/Student) on the home page, using fieldset/legend for accessibility
- `LoginForm` — Username + password form with loading state; shows `LoginFailureActions` (Register + Reset Password links) on first failure
- `RegistrationView` — Internal state machine: RoleChoiceScreen → ParentRegistrationForm or ParentLoginGate → StudentRegistrationForm
- `ValidationEngine` — Declarative validation module (`src/validation/ValidationEngine.ts`) with composable validators (length, charset, email, phone, match, required)

**Navigation flow (login failure → registration/reset):**

```
HomeView (role selected) → LoginForm → failure → LoginFailureActions
  ├── "Register" link → window.location.hash = '#register'
  └── "Reset Password" link → window.location.hash = '#forgot-password'
```

All views include a "Back to Login" link (`href="#"`) for returning to the home page.

### `packages/platform-mobile/*`

Native mobile implementations of platform contracts.

- **`mobile-app`**: Exports `createMobilePlatformProvider` — the mobile entry point
- **`rn-app`**: React Native application — screens, navigation, context, hooks, components (see Mobile App Structure above)
- **`mobile-camera`**, **`mobile-filesystem`**, **`mobile-audio`**, **`mobile-notifications`**, **`mobile-ui`**: Individual capability implementations using native APIs

## Package Naming Convention

All packages follow a strict naming pattern based on their layer:

| Layer | Pattern | Example |
|-------|---------|---------|
| Services | `@learnverse/service-{name}` | `@learnverse/service-core`, `@learnverse/service-auth` |
| Platform Contracts | `@learnverse/platform-contracts` | — |
| Web Platform | `@learnverse/web-{name}` | `@learnverse/web-app`, `@learnverse/web-camera` |
| Mobile Platform | `@learnverse/mobile-{name}` | `@learnverse/mobile-app`, `@learnverse/mobile-camera` |

The `validate:naming` script enforces these conventions.

## Build Pipeline

### Build Order

The build runs in this order:

1. **User Guide HTML generation** (`build:user-guide`) — converts `docs/USER_GUIDE.md` to static HTML at `packages/core/src/helpButton/user-guide.html`
2. **TypeScript compilation** (`tsc --build`) — compiles all packages in dependency-topological order

### User Guide Build Script

The `scripts/build-user-guide.ts` script:
- Reads `docs/USER_GUIDE.md`
- Converts markdown to HTML using `marked`
- Generates slug-based `id` attributes for H2 and H3 headings
- Builds a `<nav class="ug-toc">` element with nested `<ol>` linking to anchors
- Wraps content in `<article class="ug-content">`
- Outputs to `packages/core/src/helpButton/user-guide.html`

This file is bundled with the web app and included as an Android asset.

## Testing

### Test Framework

- **Vitest** for test execution
- **fast-check** for property-based testing
- **happy-dom** for DOM environment in component tests

### Running Tests

```bash
# Run all tests
npm run test

# Run tests for a specific service package
npx vitest run packages/services/auth

# Run a specific test file
npx vitest run packages/services/auth/src/registration.test.ts

# Run help button integration tests
npx vitest run packages/core/src/helpButton

# Run mobile UX property tests
npx vitest run packages/platform-mobile/rn-app/src/__tests__

# Watch mode
npm run test:watch
```

### Test Conventions

- Unit tests are co-located with source files: `*.test.ts`
- Property-based tests use fast-check with minimum 100 iterations
- Test files follow the naming pattern: `<module>.test.ts`
- Property test files: `<module>.property.test.ts`
- Integration tests live in `src/integration/` within the relevant package (e.g., `packages/platform-web/app/src/integration/Navigation.test.ts`)

### Integration Tests

Integration tests verify end-to-end flows across multiple components. They use real implementations (not mocks) for the components under test, mocking only external services.

**Web navigation integration test** (`packages/platform-web/app/src/integration/Navigation.test.ts`):
- Tests hash-based routing with real view factories
- Verifies navigation from login failure actions to registration and forgot-password views
- Verifies "Back to Login" links from all views navigate back to the home page
- Verifies unknown hashes render the fallback HomeView
- Mocks only AuthService (external API calls) and trivial UI components (Header, BackgroundWatermark)

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Unit test example
describe('Registration', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('short1');
    expect(result.valid).toBe(false);
  });
});

// Property-based test example
describe('Property: Username validation', () => {
  it('accepts valid usernames (5-15 chars, alphanumeric + _ + -)', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
          { minLength: 5, maxLength: 15 }
        ),
        (username) => {
          const result = validateUsername(username);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Code Conventions

### TypeScript

- Strict mode enabled
- Interfaces over type aliases for object shapes
- Explicit return types on exported functions
- No `any` — use `unknown` with type guards

### Naming

- Files: `camelCase.ts` (e.g., `syllableBreakdown.ts`)
- Interfaces: `PascalCase` (e.g., `SubjectModule`)
- Functions: `camelCase` (e.g., `validatePassword`)
- Constants: `UPPER_SNAKE_CASE` for true constants
- Packages: `@learnverse/{layer}-{name}` (see naming convention above)

### Error Handling

All errors follow the `ErrorResponse` interface:

```typescript
interface ErrorResponse {
  code: string;
  message: string;        // Child-friendly language
  field?: string;
  suggestedAction?: string;
  retryable: boolean;
}
```

### Adding a New Subject Module

1. Create a module implementing the `SubjectModule` interface
2. Define: `extractionPipeline`, `questionGenerationStrategy`, `renderingConfig`
3. Optionally add: `grammarRules`, `pronunciationAssets` (for language subjects)
4. Register via `SubjectModuleRegistry.registerModule()`
5. No changes needed to core services

### Adding a New Platform Capability

1. Define the interface in `packages/platform-contracts`
2. Add it to the `PlatformProvider` aggregate interface
3. Implement in `packages/platform-web/{capability}/`
4. Implement in `packages/platform-mobile/{capability}/`
5. Wire into the respective `createWebPlatformProvider` / `createMobilePlatformProvider`

## Validation Scripts

```bash
# Validate package naming follows @learnverse/{layer}-{name} convention
npm run validate:naming

# Validate dependency boundaries between layers
npm run validate:boundaries

# Run both validators
npm run validate
```

These validators run in CI on every pull request and must pass before merge.

## Spec-Driven Development

This project uses spec-driven development. Specs live in `.kiro/specs/`:

Each spec contains:
- `requirements.md` — Formal requirements with acceptance criteria
- `design.md` — Architecture, interfaces, data models, correctness properties
- `tasks.md` — Implementation plan with requirement traceability

Current specs:
- `.kiro/specs/chikumiku-learnverse/` — Core platform spec
- `.kiro/specs/source-code-restructuring/` — Package restructuring spec
- `.kiro/specs/help-button-user-guide/` — Help button & User Guide viewer spec
- `.kiro/specs/mobile-app-ux-improvements/` — Authentication, textbook hierarchy, camera/gallery page capture, branding
- `.kiro/specs/registration-and-password-reset/` — Web role-based login, conditional registration (parent-direct, student-via-parent), and password reset flows
- `.kiro/specs/infra-migration-to-cdk/` — Infrastructure migration to AWS CDK

## Useful Commands

```bash
npm run build              # Build User Guide HTML + TypeScript compilation
npm run build:user-guide   # Rebuild User Guide HTML only
npm run test               # Run all tests (single run)
npm run test:watch         # Run tests in watch mode
npm run lint               # ESLint across all packages
npm run validate           # Run naming + boundary validators
npm run validate:naming    # Check package naming conventions
npm run validate:boundaries # Check dependency boundary rules
npm run clean              # Remove dist/ folders
```
