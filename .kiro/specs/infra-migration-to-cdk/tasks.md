# Implementation Plan: Infrastructure Migration to AWS CDK

## Overview

Migrate ChikuMiku LearnVerse infrastructure from Serverless Framework to AWS CDK v2 (TypeScript). The implementation follows a bottom-up approach: project scaffolding → nested stacks (auth, database, storage, API, Lambda, observability) → CI/CD pipeline → Turborepo integration. All 929 existing tests continue to pass, the local dev server remains functional, and the API contract is preserved.

## Tasks

- [x] 1. Scaffold CDK project and core infrastructure
  - [x] 1.1 Initialize CDK project structure at `infra/cdk/`
    - Create `infra/cdk/` directory with `bin/`, `lib/`, `lib/constructs/`, and `__tests__/` subdirectories
    - Create `infra/cdk/package.json` with aws-cdk-lib, constructs, aws-cdk devDependencies
    - Create `infra/cdk/tsconfig.json` targeting ES2022, Node.js module resolution
    - Create `infra/cdk/cdk.json` with app entry point `npx ts-node bin/learnverse.ts` and context values
    - Add `infra/cdk` to the root `package.json` workspaces array
    - _Requirements: 1.3, 1.4, 1.7_

  - [x] 1.2 Implement CDK App entry point and root LearnVerseStack
    - Create `infra/cdk/bin/learnverse.ts` that instantiates `LearnVerseStack-qa` and `LearnVerseStack-prod`
    - Create `infra/cdk/lib/LearnVerseStack.ts` with `LearnVerseStackProps` interface (stageName: 'qa' | 'prod')
    - Implement `resourceName(suffix)` helper returning `learnverse-{stage}-{suffix}`
    - Apply stack-level tags: `learnverse:stage`, `learnverse:stack`
    - Target `ap-south-1` region
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

  - [x] 1.3 Create SecureLambda reusable construct
    - Create `infra/cdk/lib/constructs/SecureLambda.ts` implementing `SecureLambdaProps` interface
    - Configure Node.js 22 runtime (`NODEJS_22_X`), X-Ray active tracing, structured CloudWatch log group (90-day retention)
    - Set standard environment variables: `STAGE_NAME`, `AWS_NODEJS_CONNECTION_REUSE_ENABLED=1`
    - Function naming: `learnverse-{stage}-{serviceName}`
    - Default memory 256 MB, timeout 30 seconds
    - _Requirements: 3.2, 7.1_

- [x] 2. Implement AuthStack (Cognito)
  - [x] 2.1 Create AuthStack nested stack
    - Create `infra/cdk/lib/AuthStack.ts` with `AuthStackProps` interface
    - Configure Cognito User Pool: sign-in aliases (email + phone), password policy (min 8, uppercase, lowercase, digit)
    - Define custom attributes: `userType`, `parentId`, `failedAttempts`, `lockUntil`
    - Configure auto-verify (email, phone), account recovery (email only)
    - Set removal policy: RETAIN in prod, DESTROY in qa
    - Create User Pool Client: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_ADMIN_USER_PASSWORD_AUTH`
    - Token validity: access/ID 60 min, refresh 30 days, no client secret
    - Export `userPool` and `userPoolClient` properties
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Write CDK assertion tests for AuthStack
    - Test User Pool password policy matches requirement (min 8, uppercase, lowercase, digit)
    - Test custom attributes are defined (userType, parentId, failedAttempts, lockUntil)
    - Test User Pool Client auth flows configuration
    - Test removal policy per environment (RETAIN prod, DESTROY qa)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement DatabaseStack (DynamoDB)
  - [x] 3.1 Create DatabaseStack nested stack
    - Create `infra/cdk/lib/DatabaseStack.ts` with `DatabaseStackProps` interface
    - Create `learnverse-{stage}-learners` table: pk (String), sk (String), PAY_PER_REQUEST
    - Create `learnverse-{stage}-accounts` table: pk (String), sk (String), PAY_PER_REQUEST, GSI on `username`, GSI on `email`
    - Create `learnverse-{stage}-content` table: pk (String), sk (String), PAY_PER_REQUEST
    - Enable Point-in-Time Recovery on all tables
    - Set removal policy: RETAIN in prod, DESTROY in qa
    - Export `learnersTable`, `accountsTable`, `contentTable` properties
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.2 Write CDK assertion tests for DatabaseStack
    - Test all three tables have correct key schema
    - Test PAY_PER_REQUEST billing mode on all tables
    - Test GSIs on accounts table (username-index, email-index)
    - Test Point-in-Time Recovery enabled
    - Test removal policy per environment
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. Implement StorageStack (S3 + CloudFront)
  - [x] 4.1 Create StorageStack nested stack
    - Create `infra/cdk/lib/StorageStack.ts` with `StorageStackProps` interface
    - Create content bucket: block all public access, CORS (GET/PUT, all origins, 3600s), lifecycle rules (STANDARD_IA 30d, GLACIER_INSTANT_RETRIEVAL 90d)
    - Create web app bucket: block all public access, SPA error routing (index.html for 403/404)
    - Create CloudFront distribution: HTTPS redirect, HTTP/2 + HTTP/3, OAI to web app bucket
    - Add `/api/*` cache behavior pointing to API Gateway origin (caching disabled)
    - Set removal policy: RETAIN in prod for content bucket
    - Export `contentBucket`, `webAppBucket`, `distribution` properties
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

  - [x] 4.2 Write CDK assertion tests for StorageStack
    - Test content bucket public access block configuration
    - Test CORS rules on content bucket
    - Test lifecycle transitions (30d, 90d)
    - Test CloudFront distribution configuration (HTTPS, HTTP/2+3)
    - Test `/api/*` cache behavior with caching disabled
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

- [x] 5. Implement ApiStack (API Gateway + Cognito Authorizer)
  - [x] 5.1 Create ApiStack nested stack
    - Create `infra/cdk/lib/ApiStack.ts` with `ApiStackProps` interface
    - Create REST API: `learnverse-{stage}-api`, X-Ray tracing, CloudWatch metrics, access logging (JSON)
    - Configure CORS: all origins, all methods
    - Add gateway responses with CORS headers for 4XX/5XX
    - Create Cognito User Pools Authorizer with identity source `method.request.header.Authorization`
    - Define all resource paths under `/api/v1` prefix (auth, subjects, textbooks, chapters, progress, revision, learning, sync)
    - Export `api` and `authorizer` properties
    - _Requirements: 2.8, 3.8_

  - [x] 5.2 Write CDK assertion tests for ApiStack
    - Test REST API has X-Ray tracing enabled
    - Test Cognito authorizer is created with correct identity source
    - Test all resource paths are defined under `/api/v1`
    - Test CORS configuration on gateway responses
    - _Requirements: 2.8, 3.8_

- [x] 6. Checkpoint - Core stacks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement LambdaStack (4 domain Lambdas + IAM)
  - [x] 7.1 Create LambdaStack nested stack with Lambda functions
    - Create `infra/cdk/lib/LambdaStack.ts` with `LambdaStackProps` interface
    - Instantiate 4 SecureLambda constructs: auth, content, learning, sync
    - Configure environment variables per Lambda (table names, bucket name, user pool ID, client ID, stage)
    - Export `functions` map (Record<string, lambda.Function>)
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Wire API Gateway routes to Lambda integrations
    - Map Auth Lambda to POST /auth/login, POST /auth/register/parent, POST /auth/register/student, POST /auth/forgot-password, GET /auth/validate, POST /auth/refresh
    - Map Content Lambda to all content, subjects, progress, and revision routes
    - Map Learning Lambda to all /learning/* routes
    - Map Sync Lambda to POST /sync/push, GET /sync/pull
    - Set auth methods: None for public auth routes, Cognito authorizer for all protected routes
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 7.3 Configure least-privilege IAM policies per Lambda
    - Auth Lambda: accounts + learners tables R/W, Cognito admin actions (AdminInitiateAuth, AdminCreateUser, AdminSetUserPassword, AdminUpdateUserAttributes, AdminGetUser)
    - Content Lambda: content + learners tables R/W, contentBucket R/W
    - Learning Lambda: learners table R/W, content table R
    - Sync Lambda: learners + content tables R/W
    - _Requirements: 3.3_

  - [x] 7.4 Write CDK assertion tests for LambdaStack
    - Test 4 Lambda functions are created with Node.js 22 runtime
    - Test IAM policies match least-privilege matrix (no cross-domain access)
    - Test all API Gateway methods are wired to correct Lambda integrations
    - Test protected endpoints have Cognito authorizer attached
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 3.9_

  - [x] 7.5 Write property test for API contract preservation (Property 5)
    - **Property 5: API Contract Preservation**
    - For any route in `createDefaultRoutes()`, verify a matching API Gateway resource+method exists in synthesized template
    - Import `createDefaultRoutes` from existing codebase, synth the stack, assert each route has a corresponding resource
    - **Validates: Requirements 3.9**

  - [x] 7.6 Write property test for Cognito authorizer coverage (Property 3)
    - **Property 3: Protected Endpoints Require Cognito Authorization**
    - For any route marked `requiresAuth: true`, the synthesized API Gateway method SHALL have `AuthorizationType: COGNITO_USER_POOLS`
    - **Validates: Requirements 2.8**

  - [x] 7.7 Write property test for least-privilege IAM (Property 4)
    - **Property 4: Least-Privilege IAM Per Lambda**
    - For each Lambda, its IAM policy SHALL only reference table/bucket ARNs from its designated resource set
    - **Validates: Requirements 3.3**

- [x] 8. Implement ObservabilityStack
  - [x] 8.1 Create ObservabilityStack nested stack
    - Create `infra/cdk/lib/ObservabilityStack.ts` with `ObservabilityStackProps` interface
    - Create CloudWatch log group per Lambda: `/aws/lambda/learnverse-{stage}-{service}`, 90-day retention
    - Create alarm per Lambda: error rate > 1% (5-min period)
    - Create API latency alarm: p99 > 2000ms (5-min period)
    - Create CloudWatch dashboard: error rates, invocation counts, API latency
    - Create SNS topic: `learnverse-{stage}-alarms`, configure alarm actions
    - Set prod log groups to RETAIN removal policy
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 Write CDK assertion tests for ObservabilityStack
    - Test log groups have 90-day retention
    - Test alarms reference correct Lambda functions with correct thresholds
    - Test SNS topic is created and alarm actions publish to it
    - Test prod removal policy is RETAIN
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 9. Wire root stack composition and cross-stack references
  - [x] 9.1 Complete LearnVerseStack composition with all nested stacks
    - Wire AuthStack → DatabaseStack → StorageStack → ApiStack → LambdaStack → ObservabilityStack in dependency order
    - Pass cross-stack references (userPool, tables, bucket, api, authorizer, functions)
    - Verify `cdk synth` produces valid CloudFormation templates for both qa and prod
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [x] 9.2 Write property test for resource naming isolation (Property 1)
    - **Property 1: Resource Naming Convention Guarantees Environment Isolation**
    - For any resource with a user-defined physical name, verify it matches `learnverse-{stageName}-{resourceSuffix}`
    - No name collisions between qa and prod stacks
    - **Validates: Requirements 1.6, 5.6**

  - [x] 9.3 Write property test for production RETAIN policy (Property 6)
    - **Property 6: Production Resources Use RETAIN Removal Policy**
    - For any DynamoDB table, S3 bucket, or CloudWatch log group in prod, verify `DeletionPolicy: Retain`
    - **Validates: Requirements 7.6, 8.5, 9.4**

- [x] 10. Checkpoint - All CDK stacks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Lambda handler routing and local dev compatibility
  - [x] 11.1 Create Lambda handler entry points using shared ApiRouter
    - Create handler files for each domain Lambda (auth, content, learning, sync)
    - Each handler imports `createDefaultRoutes()` and filters routes by domain tag
    - Use the shared `ApiRouter` class for request dispatching
    - Map API Gateway proxy event to `ApiRequest`, response to proxy format
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 11.2_

  - [x] 11.2 Verify local dev server compatibility
    - Ensure `npx tsx packages/services/api/src/server.ts` continues to start and serve all routes
    - The local server and Lambda handlers both use `createDefaultRoutes()` and `ApiRouter`
    - No AWS credentials required for local development
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 11.3 Write property test for route registry sharing (Property 7)
    - **Property 7: Lambda Handler and Local Server Share Route Definitions**
    - For any route dispatched through Lambda handler's ApiRouter, the same route exists in local dev server's ApiRouter
    - Both routers produce identical route registries
    - **Validates: Requirements 11.2**

  - [x] 11.4 Write property test for account lockout (Property 2)
    - **Property 2: Account Lockout After Consecutive Failures**
    - For any account with 3+ consecutive failed attempts and `lockUntil` in the future, login SHALL be rejected
    - **Validates: Requirements 2.6**

- [x] 12. Implement Turborepo build pipeline
  - [x] 12.1 Add Turborepo configuration and update root scripts
    - Install `turbo` as a root devDependency
    - Create `turbo.json` at monorepo root with tasks: build, typecheck, lint, test:unit, test:property, test:integration
    - Configure `build` task: `dependsOn: ["^build"]`, inputs `src/**`, outputs `dist/**`
    - Configure `typecheck` task: `dependsOn: ["^build"]`, no cached outputs
    - Configure `test:unit` and `test:property` tasks with Vitest inputs
    - Configure `test:integration` task with `dependsOn: ["build"]`
    - Update root `package.json` scripts to use `npx turbo` commands
    - Retain npm workspaces as the package manager
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9_

  - [x] 12.2 Verify existing 929 tests pass under Turborepo pipeline
    - Run `npx turbo test:unit` and confirm all existing tests pass
    - Validate no test modifications are required
    - _Requirements: 6.7_

- [x] 13. Implement CI/CD pipeline with GitHub OIDC and environment gates
  - [x] 13.1 Create GitHub OIDC IAM role in CDK
    - Add OIDC provider and IAM role definition (can be a separate utility stack or inline)
    - Trust policy: GitHub Actions OIDC provider for the repository
    - Permissions: CDK deploy, Lambda update, S3 sync, CloudFront invalidation
    - _Requirements: 4.1, 4.2_

  - [x] 13.2 Create CI/CD workflow (`ci.yml`) with environment gates
    - Replace existing `ci.yml` with three-stage pipeline: validate → deploy-qa → deploy-prod
    - Validate stage: typecheck, lint, unit tests, property tests, integration tests, security audit, `cdk synth`
    - Deploy-qa: configure AWS via OIDC (`aws-actions/configure-aws-credentials@v4`), `cdk deploy LearnVerseStack-qa`
    - Deploy-prod: require `environment: production` manual approval, `cdk deploy LearnVerseStack-prod`
    - Post-deploy: sync web assets to S3, invalidate CloudFront cache
    - No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` secrets
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 10.4_

- [x] 14. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- CDK assertion tests validate synthesized CloudFormation output
- The existing 929 tests must continue passing without modification throughout migration
- All CDK code is TypeScript targeting Node.js 22 and `ap-south-1` region
- Local dev server (`npx tsx`) compatibility is maintained at every step

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] },
    { "id": 6, "tasks": ["7.4", "7.5", "7.6", "7.7", "8.1"] },
    { "id": 7, "tasks": ["8.2", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4", "12.1"] },
    { "id": 10, "tasks": ["12.2", "13.1"] },
    { "id": 11, "tasks": ["13.2"] }
  ]
}
```
