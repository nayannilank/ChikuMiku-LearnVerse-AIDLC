# Requirements Document

## Introduction

Migrate the ChikuMiku LearnVerse project's infrastructure from Serverless Framework to AWS CDK, modeled after the BlipZo Shopping project's architecture. This is a major infrastructure overhaul covering seven areas: CDK adoption, Cognito authentication, Lambda decomposition, GitHub OIDC, environment gates, Turborepo build pipeline, and observability infrastructure. The migration preserves the existing API contract, all 929 tests, and local development workflow while delivering improved security, modularity, and operational visibility.

## Glossary

- **CDK_App**: The AWS CDK v2 application entry point located at `infra/cdk/bin/learnverse.ts` that instantiates per-environment stacks
- **LearnVerse_Stack**: The root CDK stack that composes all nested stacks for a single deployment environment
- **Auth_Stack**: The CDK nested stack responsible for Cognito User Pool and User Pool Client resources
- **Database_Stack**: The CDK nested stack responsible for DynamoDB table definitions
- **Storage_Stack**: The CDK nested stack responsible for S3 bucket resources
- **Api_Stack**: The CDK nested stack responsible for API Gateway REST API and Cognito authorizer
- **Lambda_Stack**: The CDK nested stack responsible for Lambda functions and IAM policies
- **Observability_Stack**: The CDK nested stack responsible for CloudWatch log groups, alarms, dashboard, and SNS topic
- **Auth_Lambda**: The Lambda function handling authentication operations (login, registration, forgot password, token validation)
- **Content_Lambda**: The Lambda function handling content operations (textbooks, chapters, pages, subjects)
- **Learning_Lambda**: The Lambda function handling learning session operations (start, end, select subject, select chapter)
- **Sync_Lambda**: The Lambda function handling offline synchronization operations (push, pull)
- **Cognito_User_Pool**: The AWS Cognito User Pool managing parent and student identities
- **Cognito_Authorizer**: The API Gateway Cognito User Pools Authorizer that validates JWT tokens on protected endpoints
- **GitHub_OIDC_Role**: The IAM role assumed by GitHub Actions via OpenID Connect for keyless CI/CD authentication
- **Environment_Gate**: A GitHub Actions environment protection rule requiring manual approval before production deployment
- **Turborepo_Pipeline**: The Turborepo configuration defining parallel build tasks, caching, and test commands
- **SecureLambda_Construct**: A reusable CDK construct that standardizes Lambda function creation with X-Ray tracing, least-privilege IAM, and structured logging

## Requirements

### Requirement 1: AWS CDK Stack Structure

**User Story:** As a platform engineer, I want the infrastructure defined as typed AWS CDK stacks in TypeScript, so that infrastructure changes are type-safe, reviewable, and modular.

#### Acceptance Criteria

1. THE CDK_App SHALL instantiate one LearnVerse_Stack per deployment environment (qa, prod) with fully isolated AWS resources
2. THE LearnVerse_Stack SHALL compose the following nested stacks: Auth_Stack, Database_Stack, Storage_Stack, Api_Stack, Lambda_Stack, and Observability_Stack
3. THE CDK_App SHALL reside in the directory `infra/cdk/` within the monorepo root
4. THE CDK_App SHALL use AWS CDK v2 with TypeScript and target the ap-south-1 region
5. WHEN `cdk synth` is executed, THE CDK_App SHALL produce a valid CloudFormation template without errors
6. THE LearnVerse_Stack SHALL apply a resource naming convention of `learnverse-{stageName}-{resource}` to all provisioned resources
7. THE CDK_App SHALL define a `cdk.json` configuration file specifying the app entry point and context values

### Requirement 2: Cognito Authentication

**User Story:** As a platform engineer, I want authentication managed by AWS Cognito, so that session management, token validation, and account security are handled by a managed service instead of custom code.

#### Acceptance Criteria

1. THE Auth_Stack SHALL create a Cognito_User_Pool with sign-in aliases for both email and phone number
2. THE Auth_Stack SHALL enforce a password policy requiring minimum 8 characters, at least one uppercase letter, one lowercase letter, and one digit
3. THE Auth_Stack SHALL define custom attributes on the Cognito_User_Pool for `userType` (parent or student), `parentId` (linking students to parents), `failedAttempts`, and `lockUntil`
4. THE Auth_Stack SHALL create a User Pool Client with `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_ADMIN_USER_PASSWORD_AUTH` flows enabled
5. THE Auth_Stack SHALL configure refresh token validity of 30 days to maintain the existing 30-day session minimum
6. THE Auth_Lambda SHALL implement account lockout by setting `lockUntil` after 3 consecutive failed login attempts, preventing login for 15 minutes
7. THE Auth_Lambda SHALL support parent registration accepting phone number and email, student registration linked to a parent account, and username/password login
8. THE Api_Stack SHALL attach a Cognito_Authorizer to all protected API endpoints, replacing the custom JWT authorizer Lambda
9. WHEN a request includes an absent, expired, or invalid JWT, THE Cognito_Authorizer SHALL return HTTP 401

### Requirement 3: Lambda Decomposition

**User Story:** As a platform engineer, I want the monolithic Lambda split into domain-specific Lambdas, so that each service has independent scaling, deployment, and least-privilege permissions.

#### Acceptance Criteria

1. THE Lambda_Stack SHALL create four separate Lambda functions: Auth_Lambda, Content_Lambda, Learning_Lambda, and Sync_Lambda
2. THE Lambda_Stack SHALL use a SecureLambda_Construct for each function that enables X-Ray tracing, sets the Node.js 22 runtime, and configures structured JSON logging
3. THE Lambda_Stack SHALL attach a least-privilege IAM policy to each Lambda granting access only to the DynamoDB tables and S3 resources required by that service domain
4. THE Auth_Lambda SHALL handle routes: POST /auth/login, POST /auth/register/parent, POST /auth/register/student, POST /auth/forgot-password, GET /auth/validate
5. THE Content_Lambda SHALL handle routes: GET /subjects, POST /subjects/{subjectId}/enroll, GET /subjects/{subjectId}/textbooks, POST /subjects/{subjectId}/textbooks, GET /textbooks/{textbookId}/chapters, POST /textbooks/{textbookId}/chapters, POST /chapters/{chapterId}/pages
6. THE Learning_Lambda SHALL handle routes: POST /learning/start, POST /learning/select-subject, POST /learning/select-chapter, POST /learning/new-chapter, POST /learning/end-chapter, POST /learning/end, GET /learning/session
7. THE Sync_Lambda SHALL handle routes: POST /sync/push, GET /sync/pull
8. THE Api_Stack SHALL define all resource paths under the `/api/v1` prefix and wire each method to the corresponding Lambda integration
9. WHEN the Lambda_Stack is deployed, THE existing API contract (request paths, methods, request/response shapes) SHALL remain unchanged

### Requirement 4: GitHub OIDC Authentication

**User Story:** As a DevOps engineer, I want CI/CD to authenticate with AWS using GitHub OIDC role assumption, so that static access keys are eliminated and credentials rotate automatically.

#### Acceptance Criteria

1. THE CDK_App SHALL define a GitHub_OIDC_Role IAM role that trusts the GitHub Actions OIDC provider for the repository
2. THE GitHub_OIDC_Role SHALL grant permissions to deploy CDK stacks, update Lambda functions, manage S3 assets, and invalidate CloudFront caches
3. THE CI/CD workflow SHALL use `aws-actions/configure-aws-credentials@v4` with `role-to-assume` referencing the GitHub_OIDC_Role ARN
4. WHEN the migration is complete, THE CI/CD workflow SHALL operate without `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` repository secrets

### Requirement 5: Environment Gates

**User Story:** As a release manager, I want progressive deployment with environment gates, so that production deployments require explicit approval and each environment is fully isolated.

#### Acceptance Criteria

1. THE CI/CD workflow SHALL implement three sequential stages: validate, deploy-qa, and deploy-prod
2. THE validate stage SHALL execute type checking, linting, unit tests, property tests, integration tests, security audit, and CDK synthesis validation
3. THE deploy-qa stage SHALL deploy the LearnVerse_Stack to the qa environment after validate passes on the main branch
4. THE deploy-prod stage SHALL deploy the LearnVerse_Stack to the prod environment only after deploy-qa succeeds
5. THE deploy-prod stage SHALL require manual approval via a GitHub Actions environment protection rule on the `production` environment
6. WHEN CDK deploys to qa, THE provisioned resources SHALL be fully isolated from prod resources (separate DynamoDB tables, S3 buckets, Cognito User Pool, API Gateway, and Lambda functions)

### Requirement 6: Turborepo Build Pipeline

**User Story:** As a developer, I want Turborepo managing the monorepo build pipeline, so that builds run in parallel, are cached, and test commands are granular.

#### Acceptance Criteria

1. THE monorepo root SHALL include a `turbo.json` configuration file defining the tasks: build, typecheck, lint, test:unit, test:property, and test:integration
2. THE build task SHALL declare dependency on upstream package builds (`dependsOn: ["^build"]`) and cache `dist/**` outputs
3. THE typecheck task SHALL declare dependency on upstream builds and produce no cached outputs
4. THE test:unit task SHALL execute unit tests using Vitest with the `--run` flag for single execution
5. THE test:property task SHALL execute property-based tests using fast-check via Vitest with the `--run` flag
6. THE test:integration task SHALL depend on the build task and execute integration tests
7. WHEN Turborepo executes the build pipeline, THE existing 929 tests SHALL continue to pass without modification
8. THE monorepo SHALL retain npm workspaces as the package manager (Turborepo runs on top of npm workspaces)
9. THE root `package.json` scripts SHALL be updated to invoke Turborepo commands (`npx turbo build`, `npx turbo test:unit`, etc.)

### Requirement 7: Observability Infrastructure

**User Story:** As an operations engineer, I want CloudWatch observability resources defined as IaC, so that monitoring, alerting, and dashboards are consistently provisioned across environments.

#### Acceptance Criteria

1. THE Observability_Stack SHALL create a dedicated CloudWatch log group for each Lambda function with a 90-day retention period
2. THE Observability_Stack SHALL create CloudWatch alarms for Lambda error rate exceeding 1% per function, evaluated over a 5-minute period
3. THE Observability_Stack SHALL create a CloudWatch alarm for API response latency p99 exceeding 2000ms
4. THE Observability_Stack SHALL create a CloudWatch dashboard displaying Lambda error rates, invocation counts, and API latency metrics
5. THE Observability_Stack SHALL create an SNS topic for alarm notifications and configure alarm actions to publish to the topic
6. WHILE the deployment environment is prod, THE Observability_Stack SHALL set the log group removal policy to RETAIN

### Requirement 8: Database Infrastructure

**User Story:** As a platform engineer, I want DynamoDB tables defined in a dedicated CDK stack, so that database resources are modular, versioned, and independently managed.

#### Acceptance Criteria

1. THE Database_Stack SHALL create a DynamoDB table named `learnverse-{stageName}-learners` with partition key `pk` (String) and sort key `sk` (String) using PAY_PER_REQUEST billing
2. THE Database_Stack SHALL create a DynamoDB table named `learnverse-{stageName}-accounts` with partition key `pk` (String), sort key `sk` (String), a GSI on `username`, and a GSI on `email`, using PAY_PER_REQUEST billing
3. THE Database_Stack SHALL create a DynamoDB table named `learnverse-{stageName}-content` with partition key `pk` (String) and sort key `sk` (String) using PAY_PER_REQUEST billing
4. THE Database_Stack SHALL enable Point-in-Time Recovery on all tables
5. WHILE the deployment environment is prod, THE Database_Stack SHALL set the removal policy on all tables to RETAIN

### Requirement 9: Storage Infrastructure

**User Story:** As a platform engineer, I want S3 storage defined in a dedicated CDK stack, so that content storage resources are modular and consistently configured.

#### Acceptance Criteria

1. THE Storage_Stack SHALL create an S3 bucket named `learnverse-{stageName}-content-{accountId}` with all public access blocked
2. THE Storage_Stack SHALL configure CORS rules allowing GET and PUT methods from all origins with a 3600-second max age
3. THE Storage_Stack SHALL configure lifecycle rules transitioning objects to STANDARD_IA after 30 days and GLACIER_INSTANT_RETRIEVAL after 90 days
4. WHILE the deployment environment is prod, THE Storage_Stack SHALL set the bucket removal policy to RETAIN

### Requirement 10: Web Application Hosting

**User Story:** As a platform engineer, I want the web application hosting (S3 + CloudFront) defined in CDK, so that the static site infrastructure is version-controlled and consistently deployed.

#### Acceptance Criteria

1. THE Storage_Stack SHALL create an S3 bucket for the web application static assets with public access blocked and SPA error routing (index.html for 403/404)
2. THE Storage_Stack SHALL create a CloudFront distribution serving the web app bucket with HTTPS redirect, HTTP/2 + HTTP/3, and an Origin Access Identity
3. THE Storage_Stack SHALL configure a CloudFront cache behavior proxying `/api/*` requests to the API Gateway origin with caching disabled
4. THE CI/CD workflow SHALL sync the built web assets to the S3 bucket and invalidate the CloudFront cache after deployment

### Requirement 11: Local Development Compatibility

**User Story:** As a developer, I want the local development server to continue working after the migration, so that I can iterate without deploying to AWS.

#### Acceptance Criteria

1. WHEN a developer runs `npx tsx packages/services/api/src/server.ts`, THE local development server SHALL start and serve all API routes on the configured port
2. THE Lambda handler code SHALL import and reuse the same ApiRouter and route definitions used by the local development server
3. IF the CDK infrastructure is not deployed, THEN THE local development server SHALL operate using local configuration without requiring AWS credentials for development purposes
