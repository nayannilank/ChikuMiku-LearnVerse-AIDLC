# ChikuMiku LearnVerse — Developer Guide

## Introduction

ChikuMiku LearnVerse is a multi-subject learning platform for children built as a TypeScript monorepo with a layered architecture. This guide covers the project structure, development workflow, architecture, and conventions for contributors.

## Tech Stack

| Category | Technology | Version / Notes |
|----------|-----------|-----------------|
| **Language & Runtime** | TypeScript | 5.6 (strict mode) |
| | Node.js | 18+ |
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
| **Mobile Platform** | React Native | Android (API 26+) |
| | Metro | Bundler for React Native |
| **Backend** | Serverless Framework | AWS Lambda + API Gateway emulation via `serverless-offline` |
| | JWT | Authentication tokens (30-day minimum validity) |
| **Infrastructure** | AWS Lambda + API Gateway | Production compute |
| | DynamoDB | Database (local emulation for dev) |
| | Tiered Storage | Hot (30-day) / Cold archival |

## Prerequisites

- Node.js 18+
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
- **Backend**: `serverless` framework and `serverless-offline` plugin (installed as dev dependencies)

### Running the Web App

The web app uses Vite as its dev server. From the project root:

```bash
# Build shared packages first (required on first run or after service changes)
npm run build

# Start the Vite dev server
cd packages/platform-web/app
npx vite

# Or if a dev script is configured:
npm run dev --workspace=@chikumiku/web-app
```

The dev server starts at `http://localhost:5173` by default. It supports hot module replacement (HMR) — changes to web platform packages and UI components reflect instantly in the browser.

**Environment variables**: Create a `.env.local` file in `packages/platform-web/app/` for local overrides (API URL, etc.):

```bash
VITE_API_URL=http://localhost:3000
```

### Running the Backend Locally

The backend services run locally using `serverless-offline`, which emulates AWS Lambda and API Gateway on your machine:

```bash
# Build all service packages
npm run build

# Start the local API server
cd packages/services/api
npx serverless offline

# Or if a dev script is configured:
npm run dev:api --workspace=@chikumiku/service-api
```

This starts a local HTTP server (typically at `http://localhost:3000`) that mimics the production API Gateway + Lambda setup. All service endpoints are available locally.

**Tips**:
- Set `NODE_ENV=development` for verbose logging
- The local server auto-reloads when you rebuild service packages
- Use `--stage dev` to load development-specific configuration
- DynamoDB Local or a local Docker instance can be used for database emulation

### Running the Mobile App (Android)

The mobile app is built with React Native. To run it on an Android emulator or physical device:

```bash
# 1. Build shared packages
npm run build

# 2. Install mobile dependencies (if not already done)
cd packages/platform-mobile/app
npm install

# 3. Start the Metro bundler
npx react-native start

# 4. In a separate terminal, build and run on Android
npx react-native run-android
```

**Using Android Studio**:

1. Open Android Studio
2. Select **Open an Existing Project** and navigate to `packages/platform-mobile/app/android/`
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
cd packages/services/api && npx serverless offline

# Terminal 2: Web app (points to local backend)
cd packages/platform-web/app && npx vite

# Terminal 3: Mobile Metro bundler (points to local backend)
cd packages/platform-mobile/app && npx react-native start
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
├── package.json                     # Root workspace configuration
├── tsconfig.json                    # Root TypeScript project references
├── tsconfig.base.json               # Shared TypeScript compiler options
├── vitest.config.ts                 # Test configuration
└── eslint.config.mjs                # Linting configuration
```

## Architecture Overview

The platform follows a **layered architecture** with strict dependency boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│  Platform Web (packages/platform-web/*)                      │
│  @chikumiku/web-app, web-camera, web-filesystem, etc.       │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│  Platform Contracts (packages/platform-contracts)             │
│  @chikumiku/platform-contracts                               │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│  Services (packages/services/*)                               │
│  @chikumiku/service-core, service-auth, service-sync, etc.   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Platform Mobile (packages/platform-mobile/*)                │
│  @chikumiku/mobile-app, mobile-camera, mobile-filesystem     │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules

| Layer | Can depend on |
|-------|---------------|
| `@chikumiku/service-*` | Other service packages, `@chikumiku/platform-contracts` |
| `@chikumiku/platform-contracts` | `@chikumiku/service-core` only |
| `@chikumiku/web-*` | `@chikumiku/platform-contracts`, any service package |
| `@chikumiku/mobile-*` | `@chikumiku/platform-contracts`, any service package |

**Forbidden**: Services cannot import from web or mobile packages. Web and mobile packages cannot import from each other.

These boundaries are enforced by the `validate:boundaries` script and checked in CI.

### Pluggable Subject Module Architecture

Within the services layer:

- **Core Platform Services** (auth, content-store, sync) are subject-agnostic
- **Subject-Specific Services** (content-ingestion, pronunciation, grammar, comprehension) delegate to Subject Modules for subject-specific logic
- **Subject Modules** define extraction pipelines, question generation strategies, grammar rules, and pronunciation assets per subject

New subjects (e.g., Tamil, French, Physics) can be added by deploying a new Subject Module without modifying core services.

### Key Design Principles

1. **Offline-First**: Clients cache content locally and queue actions when offline (max 50). Sync happens automatically when connectivity is restored.
2. **Optimistic UI**: Local state updates immediately; rollback occurs if the server rejects the action.
3. **Platform-Agnostic Services**: Business logic is fully separated from platform-specific code via the contracts layer.
4. **Tiered Storage**: Hot storage for content accessed within 30 days; cold storage for older content.
5. **Build-Time Content Processing**: The User Guide is converted from Markdown to static HTML at build time — no runtime parsing needed.

## Package Details

### `packages/core`

Cross-cutting features shared across the entire application.

- **Help Button**: Persistent UI element providing access to the in-app User Guide viewer
- **User Guide Viewer**: Displays pre-built static HTML with TOC navigation, offline caching, and state preservation

### `packages/services/core`

Shared types and utilities used across all service packages.

- **Data Models**: `Learner`, `Chapter`, `Page`, `Question`, `ProgressRecord`, `ActivityScore`, `RevisionSession`, `GradeArchive`, `QueuedAction`
- **Validation**: Grade (1-12), ImageInput (format + size), registration input
- **Subject Module Registry**: `SubjectModuleRegistry` with `register`, `getModule`, `listModules`
- **Enrollment**: Multi-subject enrollment with isolation (max 10 subjects)

### `packages/services/auth`

Authentication and session management.

- **Registration**: Email/phone + password (8-128 chars, 1 letter + 1 digit)
- **Session**: JWT-based, minimum 30-day validity
- **Lockout**: 3 consecutive failures → 15-minute lock
- **Parental Linking**: Parent can view progress, reset password, update profile
- **Local Backup**: 7-day retention of progress regardless of session status

### `packages/services/content-store`

Persistent storage and progress tracking.

- **Chapter CRUD**: Save, retrieve, list (organized by subject/textbook/chapter number)
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

### `packages/platform-contracts`

Interface definitions that form the boundary between services and platform implementations.

- **CameraInterface**: Photo capture, permissions
- **FileSystemInterface**: File read/write, picker
- **AudioInterface**: Recording, playback
- **PushNotificationInterface**: Local/remote notifications
- **NavigationInterface**: Route navigation, back navigation
- **DeviceStorageInterface**: Key-value device storage
- **PlatformProvider**: Aggregate interface combining all capabilities
- **PlatformRegistry**: Runtime registry for platform provider lookup

### `packages/platform-web/*`

Browser-based implementations of platform contracts.

- **`web-app`**: Exports `createWebPlatformProvider` — the web entry point
- **`web-camera`**, **`web-filesystem`**, **`web-audio`**, **`web-notifications`**, **`web-ui`**: Individual capability implementations using browser APIs

### `packages/platform-mobile/*`

Native mobile implementations of platform contracts.

- **`mobile-app`**: Exports `createMobilePlatformProvider` — the mobile entry point
- **`mobile-camera`**, **`mobile-filesystem`**, **`mobile-audio`**, **`mobile-notifications`**, **`mobile-ui`**: Individual capability implementations using native APIs

## Package Naming Convention

All packages follow a strict naming pattern based on their layer:

| Layer | Pattern | Example |
|-------|---------|---------|
| Services | `@chikumiku/service-{name}` | `@chikumiku/service-core`, `@chikumiku/service-auth` |
| Platform Contracts | `@chikumiku/platform-contracts` | — |
| Web Platform | `@chikumiku/web-{name}` | `@chikumiku/web-app`, `@chikumiku/web-camera` |
| Mobile Platform | `@chikumiku/mobile-{name}` | `@chikumiku/mobile-app`, `@chikumiku/mobile-camera` |

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

# Watch mode
npm run test:watch
```

### Test Conventions

- Unit tests are co-located with source files: `*.test.ts`
- Property-based tests use fast-check with minimum 100 iterations
- Test files follow the naming pattern: `<module>.test.ts`
- Property test files: `<module>.property.test.ts`

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
describe('Property: Registration input validation', () => {
  it('accepts valid passwords (8-128 chars, 1 letter + 1 digit)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 128 }).filter(s => /[a-zA-Z]/.test(s) && /\d/.test(s)),
        (password) => {
          const result = validatePassword(password);
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
- Packages: `@chikumiku/{layer}-{name}` (see naming convention above)

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
# Validate package naming follows @chikumiku/{layer}-{name} convention
npm run validate:naming

# Validate dependency boundaries between layers
npm run validate:boundaries

# Run both validators
npm run validate
```

These validators run in CI on every pull request and must pass before merge.

## Spec-Driven Development

This project uses spec-driven development. Specs live in `.kiro/specs/`:

- `.kiro/specs/chikumiku-learnverse/` — Core platform spec
- `.kiro/specs/source-code-restructuring/` — Package restructuring spec
- `.kiro/specs/help-button-user-guide/` — Help button & User Guide viewer spec

Each spec contains:
- `requirements.md` — Formal requirements with acceptance criteria
- `design.md` — Architecture, interfaces, data models, correctness properties
- `tasks.md` — Implementation plan with requirement traceability

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
