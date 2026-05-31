# Implementation Plan: Source Code Restructuring

## Overview

Restructure the ChikuMiku LearnVerse monorepo into a layered architecture with `packages/services/*` for domain logic, `packages/platform-contracts` for interface boundaries, `packages/platform-web/*` for web implementations, and `packages/platform-mobile/*` for mobile implementations. The migration preserves all existing functionality and tests while introducing enforceable dependency boundaries.

## Tasks

- [x] 1. Create platform-contracts package and extract interfaces
  - [x] 1.1 Create `packages/platform-contracts` package with `package.json`, `tsconfig.json`, and `src/index.ts`
    - Create `packages/platform-contracts/package.json` with name `@chikumiku/platform-contracts`
    - Create `packages/platform-contracts/tsconfig.json` with composite mode enabled
    - Extract all interfaces and types from `packages/api/src/platformInterface.ts` into `packages/platform-contracts/src/index.ts`
    - Add new `NavigationInterface` and `DeviceStorageInterface` as defined in the design
    - Include the `PlatformRegistry` class in the contracts package
    - Ensure the package exports only TypeScript interfaces, type aliases, and the PlatformRegistry class
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 1.2 Write property test for platform-contracts containing no platform-specific code
    - **Property 7: Platform-contracts contains no platform-specific code**
    - Verify no source file in `platform-contracts` references browser APIs (window, document, navigator, localStorage, IndexedDB) or native mobile APIs
    - **Validates: Requirements 5.4**

- [x] 2. Migrate existing packages to `packages/services/*`
  - [x] 2.1 Move all 9 existing packages to `packages/services/` and rename them
    - Move `packages/api` → `packages/services/api`
    - Move `packages/auth` → `packages/services/auth`
    - Move `packages/comprehension` → `packages/services/comprehension`
    - Move `packages/content-ingestion` → `packages/services/content-ingestion`
    - Move `packages/content-store` → `packages/services/content-store`
    - Move `packages/core` → `packages/services/core`
    - Move `packages/grammar` → `packages/services/grammar`
    - Move `packages/pronunciation` → `packages/services/pronunciation`
    - Move `packages/sync` → `packages/services/sync`
    - Update each `package.json` name field to `@chikumiku/service-{name}` pattern
    - _Requirements: 1.2, 2.1, 4.4_

  - [x] 2.2 Update all internal import paths across service packages
    - Replace all `@chikumiku/core` imports with `@chikumiku/service-core`
    - Replace all `@chikumiku/auth` imports with `@chikumiku/service-auth`
    - Replace all `@chikumiku/comprehension` imports with `@chikumiku/service-comprehension`
    - Replace all `@chikumiku/content-ingestion` imports with `@chikumiku/service-content-ingestion`
    - Replace all `@chikumiku/content-store` imports with `@chikumiku/service-content-store`
    - Replace all `@chikumiku/grammar` imports with `@chikumiku/service-grammar`
    - Replace all `@chikumiku/pronunciation` imports with `@chikumiku/service-pronunciation`
    - Replace all `@chikumiku/sync` imports with `@chikumiku/service-sync`
    - Replace all `@chikumiku/api` imports with `@chikumiku/service-api`
    - Update dependency references in each package's `package.json`
    - _Requirements: 4.3, 4.5_

  - [x] 2.3 Remove `platformInterface.ts` from `packages/services/api` and add dependency on `@chikumiku/platform-contracts`
    - Delete `packages/services/api/src/platformInterface.ts`
    - Add `@chikumiku/platform-contracts` as a dependency in `packages/services/api/package.json`
    - Update any imports of platform types in service-api to reference `@chikumiku/platform-contracts`
    - _Requirements: 5.5_

- [x] 3. Update workspace configuration and TypeScript project references
  - [x] 3.1 Update root `package.json` workspace globs
    - Change `workspaces` from `["packages/*"]` to `["packages/services/*", "packages/platform-contracts", "packages/platform-web/*", "packages/platform-mobile/*"]`
    - Update lint script glob to cover new directory structure
    - _Requirements: 1.1, 6.1_

  - [x] 3.2 Update all `tsconfig.json` files with correct project references
    - Update each service package's `tsconfig.json` references to point to new relative paths under `packages/services/`
    - Add reference to `packages/platform-contracts` in service packages that use platform types
    - Ensure `platform-contracts/tsconfig.json` references only `service-core`
    - Create or update root `tsconfig.json` with all package paths in its `references` array
    - Ensure composite mode and declaration emit are enabled in all packages
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4. Checkpoint - Verify migration builds and tests pass
  - Ensure `tsc --build` succeeds from workspace root with zero type errors
  - Ensure `vitest run` passes with the same number of tests as before migration
  - Ensure `npm ls` reports zero missing or invalid internal package links
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.6, 4.1, 4.2, 4.6, 4.7_

- [x] 5. Create platform-web scaffold packages
  - [x] 5.1 Create `packages/platform-web/app` package with `createWebPlatformProvider`
    - Create `package.json` with name `@chikumiku/web-app`
    - Create `tsconfig.json` referencing `platform-contracts` and service packages
    - Create `src/index.ts` exporting `createWebPlatformProvider()` function
    - Implement stub that returns a `PlatformProvider` with `platform: 'web'` and all interface properties assigned
    - _Requirements: 8.1, 2.3_

  - [x] 5.2 Create `packages/platform-web/camera` package
    - Create `package.json` with name `@chikumiku/web-camera`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `WebCameraAdapter` class implementing `CameraInterface`
    - _Requirements: 1.4, 2.3_

  - [x] 5.3 Create `packages/platform-web/filesystem` package
    - Create `package.json` with name `@chikumiku/web-filesystem`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `WebFileSystemAdapter` class implementing `FileSystemInterface`
    - _Requirements: 1.4, 2.3_

  - [x] 5.4 Create `packages/platform-web/notifications` package
    - Create `package.json` with name `@chikumiku/web-notifications`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `WebNotificationAdapter` class implementing `PushNotificationInterface`
    - _Requirements: 1.4, 2.3_

  - [x] 5.5 Create `packages/platform-web/audio` package
    - Create `package.json` with name `@chikumiku/web-audio`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `WebAudioAdapter` class implementing `AudioInterface`
    - _Requirements: 1.4, 2.3_

  - [x] 5.6 Create `packages/platform-web/ui` package
    - Create `package.json` with name `@chikumiku/web-ui`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` with placeholder exports for web UI components
    - _Requirements: 1.4, 2.3_

- [x] 6. Create platform-mobile scaffold packages
  - [x] 6.1 Create `packages/platform-mobile/app` package with `createMobilePlatformProvider`
    - Create `package.json` with name `@chikumiku/mobile-app`
    - Create `tsconfig.json` referencing `platform-contracts` and service packages
    - Create `src/index.ts` exporting `createMobilePlatformProvider()` function
    - Implement stub that returns a `PlatformProvider` with `platform` based on runtime OS and all interface properties assigned
    - _Requirements: 8.2, 2.4_

  - [x] 6.2 Create `packages/platform-mobile/camera` package
    - Create `package.json` with name `@chikumiku/mobile-camera`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `MobileCameraAdapter` class implementing `CameraInterface`
    - _Requirements: 1.5, 2.4_

  - [x] 6.3 Create `packages/platform-mobile/filesystem` package
    - Create `package.json` with name `@chikumiku/mobile-filesystem`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `MobileFileSystemAdapter` class implementing `FileSystemInterface`
    - _Requirements: 1.5, 2.4_

  - [x] 6.4 Create `packages/platform-mobile/notifications` package
    - Create `package.json` with name `@chikumiku/mobile-notifications`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `MobileNotificationAdapter` class implementing `PushNotificationInterface`
    - _Requirements: 1.5, 2.4_

  - [x] 6.5 Create `packages/platform-mobile/audio` package
    - Create `package.json` with name `@chikumiku/mobile-audio`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` exporting `MobileAudioAdapter` class implementing `AudioInterface`
    - _Requirements: 1.5, 2.4_

  - [x] 6.6 Create `packages/platform-mobile/ui` package
    - Create `package.json` with name `@chikumiku/mobile-ui`
    - Create `tsconfig.json` referencing `platform-contracts`
    - Create `src/index.ts` with placeholder exports for mobile UI components
    - _Requirements: 1.5, 2.4_

- [x] 7. Checkpoint - Verify full workspace builds with platform packages
  - Ensure `tsc --build` succeeds from workspace root including all new platform packages
  - Ensure no circular dependencies exist in the TypeScript project references
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.5, 6.7_

- [x] 8. Implement dependency boundary validator
  - [x] 8.1 Finalize the dependency boundary validator in `scripts/validate-boundaries.ts`
    - Verify `classifyPackageLayer(name)` correctly categorizes packages into `services`, `contracts`, `web`, or `mobile` layers
    - Verify `validateDependencyBoundaries(packages)` reads each package's `package.json` and checks `dependencies` and `devDependencies` against the allowed/forbidden rules
    - Ensure service packages may only depend on other service packages or `@chikumiku/platform-contracts`
    - Ensure platform-contracts may only depend on `@chikumiku/service-core`
    - Ensure web packages may depend on platform-contracts and service packages, but NOT mobile packages
    - Ensure mobile packages may depend on platform-contracts and service packages, but NOT web packages
    - Ensure packages whose names don't match any known layer pattern are skipped without error
    - Ensure violations report offending package name, forbidden dependency, and human-readable reason
    - Ensure the script exits with non-zero code when violations are found
    - Verify the `glob-util.ts` helper correctly resolves workspace package directories
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 8.2 Write property test for dependency boundary validator detecting forbidden imports
    - **Property 2: Dependency boundary validator detects forbidden imports**
    - Generate random dependency graphs with known violations (service importing web/mobile, web importing mobile, mobile importing web) using fast-check
    - Verify the validator reports a violation for each forbidden dependency
    - Create test file at `scripts/__tests__/validate-boundaries.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 8.3 Write property test for dependency boundary validator accepting valid imports
    - **Property 3: Dependency boundary validator accepts valid imports**
    - Generate random dependency graphs where all packages only depend on their allowed targets using fast-check
    - Verify the validator reports zero violations for all valid graphs
    - **Validates: Requirements 3.4, 3.5, 3.6, 3.7**

  - [ ]* 8.4 Write property test for violation reports containing required information
    - **Property 4: Violation reports contain required information**
    - For any detected violation, verify the report includes a non-empty package name, a non-empty forbidden dependency name, and a non-empty human-readable reason string
    - **Validates: Requirements 3.8**

- [x] 9. Implement package naming validation
  - [x] 9.1 Finalize the package naming convention validator in `scripts/validate-naming.ts`
    - Verify the validator checks that each package's `name` field matches the expected pattern for its directory location
    - Ensure service packages match `@chikumiku/service-{name}` with `{name}` being `[a-z][a-z0-9-]*` (1-50 chars)
    - Ensure web packages match `@chikumiku/web-{name}` with the same name constraints
    - Ensure mobile packages match `@chikumiku/mobile-{name}` with the same name constraints
    - Ensure platform-contracts is exactly `@chikumiku/platform-contracts`
    - Ensure validation errors are reported for non-conforming names with the package directory, actual name, and expected pattern
    - Ensure the script exits with non-zero code when violations are found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 9.2 Write property test for package naming matches layer convention
    - **Property 1: Package naming matches layer convention**
    - Generate random package names and directory paths using fast-check
    - Verify the validator correctly identifies conforming names (returns null) and non-conforming names (returns a violation)
    - Create test file at `scripts/__tests__/validate-naming.property.test.ts`
    - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 10. Add CI integration for boundary validation
  - [x] 10.1 Add npm scripts for running both validators
    - Add `"validate:boundaries"` script to root `package.json` that executes `npx tsx scripts/validate-boundaries.ts`
    - Ensure both `validate:naming` and `validate:boundaries` scripts complete within 30 seconds for up to 30 packages
    - Add a combined `"validate"` script that runs both validators sequentially
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 10.2 Run both validators against the current workspace and fix any violations
    - Execute `npm run validate:naming` and confirm zero violations
    - Execute `npm run validate:boundaries` and confirm zero violations
    - Fix any violations found (incorrect dependencies or naming in package.json files)
    - _Requirements: 3.9, 7.3_

- [x] 11. Checkpoint - Verify validators pass on current workspace
  - Ensure `npm run validate:boundaries` reports zero violations
  - Ensure `npm run validate:naming` reports zero violations
  - Ensure `tsc --build` still succeeds
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 7.3, 6.5_

- [x] 12. Write unit tests for platform providers
  - [x]* 12.1 Write unit tests for `createWebPlatformProvider`
    - Create test file at `packages/platform-web/app/src/__tests__/index.test.ts`
    - Test that the returned provider has `platform === 'web'`
    - Test that all six interface properties (`camera`, `fileSystem`, `notifications`, `audio`, `navigation`, `storage`) are non-null objects
    - Test that no permissions are requested on construction (no side effects)
    - Test that capability methods throw or reject appropriately when invoked (stub behavior)
    - _Requirements: 8.1, 8.4, 8.5_

  - [x]* 12.2 Write unit tests for `createMobilePlatformProvider`
    - Create test file at `packages/platform-mobile/app/src/__tests__/index.test.ts`
    - Test that the returned provider has `platform` set to `'android'` or `'ios'`
    - Test that all six interface properties (`camera`, `fileSystem`, `notifications`, `audio`, `navigation`, `storage`) are non-null objects
    - Test that no permissions are requested on construction (no side effects)
    - Test that capability methods throw or reject appropriately when invoked (stub behavior)
    - _Requirements: 8.2, 8.4, 8.5_

  - [x]* 12.3 Write property test for PlatformRegistry throwing without active provider
    - **Property 9: PlatformRegistry throws without active provider**
    - Create test file at `packages/platform-contracts/src/__tests__/registry.property.test.ts`
    - For any sequence of `register()` calls without a successful `setActive()`, verify `getActive()` throws with message `'No active platform provider. Call setActive() first.'`
    - Use fast-check to generate random sequences of registry operations
    - **Validates: Requirements 8.3**

- [x] 13. Final checkpoint - Full verification
  - Ensure `tsc --build` succeeds from workspace root with all packages
  - Ensure `vitest run` passes all existing tests plus new tests
  - Ensure `npm run validate:boundaries` reports zero violations
  - Ensure `npm run validate:naming` reports zero violations
  - Ensure no service package contains browser or native mobile API references
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.6, 4.1, 4.2, 6.5, 7.3, 9.1, 9.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major structural changes
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The dependency boundary validator (`scripts/validate-boundaries.ts`) and naming validator (`scripts/validate-naming.ts`) already exist as scripts — remaining work is verification, testing, and CI integration
- Platform adapter implementations (web/mobile) are stubs initially; full implementations depend on platform-specific dependencies being added later
- The `glob-util.ts` helper in `scripts/` provides workspace directory resolution for the boundary validator

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["8.1", "9.1"] },
    { "id": 1, "tasks": ["8.2", "8.3", "8.4", "9.2", "10.1"] },
    { "id": 2, "tasks": ["10.2"] },
    { "id": 3, "tasks": ["12.1", "12.2", "12.3"] }
  ]
}
```
