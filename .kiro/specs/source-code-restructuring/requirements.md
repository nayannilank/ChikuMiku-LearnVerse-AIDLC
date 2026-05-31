# Requirements Document

## Introduction

This document defines the requirements for restructuring the ChikuMiku LearnVerse monorepo into a layered architecture that clearly separates service logic, platform contracts, web-specific implementations, and mobile-specific implementations. The restructuring preserves all existing functionality and tests while introducing enforceable dependency boundaries between layers.

## Glossary

- **Service_Package**: A package located under `packages/services/*` containing platform-agnostic domain logic (e.g., `@chikumiku/service-core`, `@chikumiku/service-auth`)
- **Platform_Contracts**: The `packages/platform-contracts` package that defines interface boundaries between service logic and platform-specific code (`@chikumiku/platform-contracts`)
- **Web_Package**: A package located under `packages/platform-web/*` implementing platform contracts using browser APIs (`@chikumiku/web-*`)
- **Mobile_Package**: A package located under `packages/platform-mobile/*` implementing platform contracts using native device APIs (`@chikumiku/mobile-*`)
- **Dependency_Boundary_Validator**: A tool or script that analyzes package dependency graphs and reports violations of the layered architecture rules
- **Migration**: The process of relocating existing packages from `packages/*` to `packages/services/*` while updating all import paths and package names
- **PlatformProvider**: The aggregate interface that combines all platform-specific capability interfaces (camera, file system, notifications, audio, navigation, storage)
- **PlatformRegistry**: A runtime registry that manages platform provider registration and lookup, enabling service logic to access platform features without direct coupling

## Requirements

### Requirement 1: Layered Directory Structure

**User Story:** As a developer, I want the monorepo organized into distinct layers (services, platform-contracts, platform-web, platform-mobile), so that I can immediately understand where code belongs based on its responsibility.

#### Acceptance Criteria

1. THE Workspace root `package.json` SHALL define workspace globs as `packages/services/*`, `packages/platform-contracts`, `packages/platform-web/*`, and `packages/platform-mobile/*`
2. WHEN the restructuring is complete, THE Workspace SHALL contain all nine existing packages (`api`, `auth`, `comprehension`, `content-ingestion`, `content-store`, `core`, `grammar`, `pronunciation`, `sync`) relocated under `packages/services/`, each retaining its own `package.json`, `src/` directory, and existing source files
3. THE Workspace SHALL contain a `packages/platform-contracts` directory that is a valid npm package exporting only TypeScript interfaces and type definitions extracted from the existing `platformInterface.ts` (including `PlatformProvider`, `PlatformRegistry`, and all related interface and type exports), with no platform-specific implementation code
4. THE Workspace SHALL contain `packages/platform-web/` with subdirectories for `app`, `camera`, `filesystem`, `notifications`, `audio`, and `ui`, each being a valid npm package containing at minimum a `package.json` and a `src/index.ts` entry point
5. THE Workspace SHALL contain `packages/platform-mobile/` with subdirectories for `app`, `camera`, `filesystem`, `notifications`, `audio`, and `ui`, each being a valid npm package containing at minimum a `package.json` and a `src/index.ts` entry point
6. WHEN the restructuring is complete, THE Workspace SHALL pass `tsc --build` and `vitest run` with no errors, confirming that all existing tests and type checks remain valid under the new directory layout

### Requirement 2: Package Naming Convention

**User Story:** As a developer, I want consistent package naming that reflects the layer each package belongs to, so that I can identify a package's role from its name alone.

#### Acceptance Criteria

1. THE Build_System SHALL set the `name` field in each service package's `package.json` using the pattern `@chikumiku/service-{name}`, where `{name}` is a lowercase kebab-case identifier of 1 to 50 characters matching `[a-z][a-z0-9-]*` (e.g., `@chikumiku/service-core`, `@chikumiku/service-auth`, `@chikumiku/service-content-ingestion`)
2. THE Build_System SHALL set the `name` field in the platform contracts package's `package.json` as `@chikumiku/platform-contracts`
3. THE Build_System SHALL set the `name` field in each web platform package's `package.json` using the pattern `@chikumiku/web-{name}`, where `{name}` is a lowercase kebab-case identifier of 1 to 50 characters matching `[a-z][a-z0-9-]*` (e.g., `@chikumiku/web-camera`, `@chikumiku/web-app`)
4. THE Build_System SHALL set the `name` field in each mobile platform package's `package.json` using the pattern `@chikumiku/mobile-{name}`, where `{name}` is a lowercase kebab-case identifier of 1 to 50 characters matching `[a-z][a-z0-9-]*` (e.g., `@chikumiku/mobile-camera`, `@chikumiku/mobile-app`)
5. IF a package's `name` field does not match any of the defined layer patterns (`@chikumiku/service-{name}`, `@chikumiku/platform-contracts`, `@chikumiku/web-{name}`, `@chikumiku/mobile-{name}`), THEN THE Build_System SHALL report a validation error identifying the non-conforming package name and the expected pattern for its directory location

### Requirement 3: Dependency Boundary Enforcement

**User Story:** As a developer, I want the build system to prevent illegal cross-layer imports, so that the layered architecture remains intact as the codebase evolves.

#### Acceptance Criteria

1. THE Dependency_Boundary_Validator SHALL reject any Service_Package that imports from a Web_Package or Mobile_Package
2. THE Dependency_Boundary_Validator SHALL reject any Web_Package that imports from a Mobile_Package
3. THE Dependency_Boundary_Validator SHALL reject any Mobile_Package that imports from a Web_Package
4. THE Dependency_Boundary_Validator SHALL allow Service_Package imports from other Service_Packages and from Platform_Contracts
5. THE Dependency_Boundary_Validator SHALL allow Platform_Contracts imports only from `@chikumiku/service-core`
6. THE Dependency_Boundary_Validator SHALL allow Web_Package imports from Platform_Contracts and any Service_Package
7. THE Dependency_Boundary_Validator SHALL allow Mobile_Package imports from Platform_Contracts and any Service_Package
8. WHEN a dependency boundary violation is detected, THE Dependency_Boundary_Validator SHALL report the offending package name, the forbidden dependency, and a human-readable reason describing which layer rule was violated
9. WHEN one or more dependency boundary violations are detected, THE Dependency_Boundary_Validator SHALL exit with a non-zero exit code so that the build or CI pipeline fails
10. IF a package name does not match any known layer pattern (`@chikumiku/service-*`, `@chikumiku/platform-contracts`, `@chikumiku/web-*`, `@chikumiku/mobile-*`), THEN THE Dependency_Boundary_Validator SHALL skip that package without reporting a violation and without failing the validation run
11. THE Dependency_Boundary_Validator SHALL determine dependency relationships by inspecting the `dependencies` and `devDependencies` fields of each package's `package.json` file within the monorepo workspace

### Requirement 4: Migration of Existing Packages

**User Story:** As a developer, I want existing packages migrated to the new structure without losing any functionality or test coverage, so that the restructuring is a safe refactoring operation.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Build_System SHALL compile all relocated packages without errors using `tsc --build`, producing a zero exit code with no type errors or module resolution failures
2. WHEN the migration is complete, THE Test_Runner SHALL execute all existing tests using `vitest run` and produce the same number of total tests, the same number of passing tests, and the same number of failing tests as the test run recorded immediately before the migration
3. WHEN the migration is complete, THE Migration SHALL have updated all internal import paths so that no source file contains references to the old package names (`@chikumiku/core`, `@chikumiku/auth`, `@chikumiku/comprehension`, `@chikumiku/content-ingestion`, `@chikumiku/content-store`, `@chikumiku/grammar`, `@chikumiku/pronunciation`, `@chikumiku/sync`, `@chikumiku/api`), and all internal imports use the new `@chikumiku/service-{name}` naming convention
4. WHEN the migration is complete, THE Migration SHALL have preserved every source file (`.ts`), test file (`.test.ts`), and configuration file (`package.json`, `tsconfig.json`) from each of the 9 original packages (`api`, `auth`, `comprehension`, `content-ingestion`, `content-store`, `core`, `grammar`, `pronunciation`, `sync`) in their corresponding `packages/services/{name}/` location with identical file content except for import path updates
5. THE Migration SHALL not modify any service logic, type definitions, exported function signatures, or test assertions during the relocation process; only import/export path statements and package name references in `package.json` files SHALL be changed
6. WHEN the migration is complete, THE Build_System SHALL resolve all workspace packages from the updated root `package.json` workspaces configuration, and `npm ls` SHALL report zero missing or invalid internal package links
7. WHEN the migration is complete, THE Build_System SHALL resolve all TypeScript project references in each relocated package's `tsconfig.json` so that `tsc --build` follows the correct dependency graph across the new `packages/services/*` directory structure

### Requirement 5: Platform Contracts Extraction

**User Story:** As a developer, I want platform interface definitions extracted into a dedicated contracts package, so that service logic and platform implementations share a single source of truth for their integration boundary.

#### Acceptance Criteria

1. WHEN the extraction is complete, THE Platform_Contracts package SHALL export all interfaces and supporting types currently defined in `packages/api/src/platformInterface.ts` (CameraInterface, CameraCaptureOptions, CameraCaptureResult, CameraError, FileSystemInterface, FileMetadata, FileReadResult, FilePickerOptions, FileSystemError, PushNotificationInterface, NotificationPayload, NotificationPermission, NotificationError, AudioInterface, AudioRecordingOptions, AudioRecordingResult, AudioPlaybackOptions, AudioError, PlatformProvider, PlatformRegistry)
2. THE Platform_Contracts package SHALL define a NavigationInterface with the following methods: `navigate(route: string, params?: Record<string, string>): void`, `goBack(): void`, `getCurrentRoute(): string`, and `canGoBack(): boolean`
3. THE Platform_Contracts package SHALL define a DeviceStorageInterface with the following methods: `getItem(key: string): Promise<string | null>`, `setItem(key: string, value: string): Promise<void>`, `removeItem(key: string): Promise<void>`, `clear(): Promise<void>`, and `getAllKeys(): Promise<string[]>`
4. THE Platform_Contracts package SHALL export only TypeScript type definitions (interfaces, type aliases, enums) and the PlatformRegistry class, and SHALL contain no references to browser APIs (window, document, navigator, localStorage, IndexedDB), native mobile APIs (React Native modules, Expo modules), or any runtime platform-specific code
5. WHEN the extraction is complete, THE Service_Package `@chikumiku/service-api` SHALL no longer contain `platformInterface.ts` and SHALL import platform types from `@chikumiku/platform-contracts`
6. WHEN the extraction is complete, THE Platform_Contracts package SHALL compile successfully with `tsc --build` as a standalone TypeScript package with no compilation errors

### Requirement 6: Build System Configuration

**User Story:** As a developer, I want the workspace and TypeScript build configuration updated to support the new layered structure, so that builds, IDE navigation, and incremental compilation work correctly.

#### Acceptance Criteria

1. THE root `package.json` SHALL define workspace globs as `packages/services/*`, `packages/platform-contracts`, `packages/platform-web/*`, and `packages/platform-mobile/*`
2. THE Build_System SHALL configure TypeScript project references so that service packages reference only other service packages and `platform-contracts`, and `platform-contracts` references only `service-core`
3. THE Build_System SHALL configure TypeScript project references so that platform-web and platform-mobile packages reference `platform-contracts` and service packages, but SHALL NOT reference each other
4. THE root workspace SHALL contain a `tsconfig.json` that lists all package paths in its `references` array so that `tsc --build` from the workspace root resolves the full dependency graph
5. WHEN `tsc --build` is executed from the workspace root, THE Build_System SHALL compile all packages in dependency-topological order and exit with code 0 and zero type errors
6. THE Build_System SHALL support incremental compilation by enabling TypeScript composite mode and generating `.tsbuildinfo` files per package, so that subsequent `tsc --build` invocations skip recompilation of packages whose source files have not changed since the last successful build
7. IF a circular dependency is introduced between packages in the TypeScript project references, THEN THE Build_System SHALL fail the `tsc --build` command with an error message indicating the cycle

### Requirement 7: CI Validation of Dependency Boundaries

**User Story:** As a team lead, I want CI pipelines to automatically validate dependency boundaries on every change, so that violations are caught before code is merged.

#### Acceptance Criteria

1. WHEN a pull request is submitted or updated with new commits, THE CI_Pipeline SHALL execute the Dependency_Boundary_Validator against all packages defined in the monorepo workspace configuration
2. WHEN the Dependency_Boundary_Validator reports one or more violations, THE CI_Pipeline SHALL fail the build and display each violation including the offending package name, the forbidden dependency name, and the reason the dependency is disallowed
3. WHEN the Dependency_Boundary_Validator reports zero violations, THE CI_Pipeline SHALL allow the build to proceed to subsequent stages
4. THE CI_Pipeline SHALL execute the Dependency_Boundary_Validator as a distinct step that runs before compilation and completes within 30 seconds for up to 30 packages
5. IF the Dependency_Boundary_Validator fails to execute due to an internal error or timeout, THEN THE CI_Pipeline SHALL fail the build and display an error message indicating the validator could not complete

### Requirement 8: Platform Provider Implementation Completeness

**User Story:** As a developer, I want platform implementations to fully satisfy the PlatformProvider interface, so that service logic can rely on all platform capabilities being available at runtime.

#### Acceptance Criteria

1. THE Web_Package `@chikumiku/web-app` SHALL export a `createWebPlatformProvider` function that returns a PlatformProvider with `platform` set to `'web'` and all four interface properties (`camera`, `fileSystem`, `notifications`, `audio`) assigned to non-null objects implementing their respective interfaces
2. THE Mobile_Package `@chikumiku/mobile-app` SHALL export a `createMobilePlatformProvider` function that returns a PlatformProvider with `platform` set to `'android'` or `'ios'` based on the runtime operating system, and all four interface properties (`camera`, `fileSystem`, `notifications`, `audio`) assigned to non-null objects implementing their respective interfaces
3. IF `PlatformRegistry.getActive()` is called without a prior successful `setActive()` call, THEN THE PlatformRegistry SHALL throw an error with the message `'No active platform provider. Call setActive() first.'`
4. THE PlatformProvider implementations SHALL NOT request device permissions during provider construction; permissions SHALL be requested only when a method that requires device access (`capture`, `pickFiles`, `readFile`, `writeFile`, `startRecording`, `registerForPush`, `showLocalNotification`) is first invoked
5. IF a PlatformProvider capability method is invoked and the underlying platform API is unavailable, THEN THE PlatformProvider SHALL reject the returned Promise with the corresponding error type defined in the interface (e.g., `CAMERA_UNAVAILABLE`, `MICROPHONE_UNAVAILABLE`, `NOT_SUPPORTED`) without throwing an unhandled exception

### Requirement 9: Service Logic Isolation

**User Story:** As a developer, I want service logic packages to be fully testable without any platform dependencies, so that unit tests run fast and do not require browser or device environments.

#### Acceptance Criteria

1. THE Service_Packages SHALL contain no import statements or global references to browser APIs (including but not limited to window, document, navigator, localStorage, sessionStorage, IndexedDB, Notification, MediaDevices, Service Worker, and Web Audio API)
2. THE Service_Packages SHALL contain no import statements or global references to native mobile APIs (including but not limited to React Native core modules, Expo SDK modules, and platform-specific native modules)
3. WHEN testing a Service_Package, THE Test_Runner SHALL execute all unit tests in a Node.js environment without browser polyfills or device emulators, using only mocks or stubs of Platform_Contracts interfaces, and complete the full test suite within 30 seconds
4. THE Service_Packages SHALL access platform capabilities (camera, file system, push notifications, audio, navigation, and device storage) exclusively through the PlatformProvider interface obtained from PlatformRegistry as defined in Platform_Contracts
5. WHEN a source file in a Service_Package is added or modified, THE Dependency_Boundary_Validator SHALL statically verify that the file contains no references to browser APIs or native mobile APIs and report any violations with the file path and offending reference
