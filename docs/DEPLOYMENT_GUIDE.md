# ChikuMiku LearnVerse — Deployment Guide

## Overview

ChikuMiku LearnVerse is deployed as a cloud-hosted multi-tenant SaaS application with a layered monorepo architecture. This guide covers infrastructure setup, deployment procedures, scaling configuration, and operational concerns.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                      Clients                             │
│   Android App (8.0+)    │    Web App (PWA)              │
│   (bundled User Guide)  │    (cached User Guide)        │
└────────────────┬────────────────────┬───────────────────┘
                 │                    │
                 ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway / Load Balancer                  │
│         (HTTPS termination, rate limiting)                │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│              Serverless Compute Layer                     │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│   │   Auth   │ │ Content  │ │  Subject │ │   Sync   │ │
│   │ Service  │ │  Store   │ │ Services │ │ Service  │ │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                    Data Layer                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│   │ Database │ │  Object  │ │  Cache   │ │ Message  │ │
│   │ (NoSQL)  │ │ Storage  │ │ (Redis)  │ │  Queue   │ │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

- AWS Account (or equivalent cloud provider)
- Node.js 18+ (for build)
- AWS CLI v2 (for deployment)
- Terraform or AWS CDK (for infrastructure-as-code)

## Monorepo Package Layout

The deployment artifacts are produced from the following layered structure:

```
packages/
├── core/                    # Cross-cutting features (help button, User Guide viewer)
├── services/                # Deployable service logic
│   ├── core/                # @chikumiku/service-core
│   ├── auth/                # @chikumiku/service-auth
│   ├── content-store/       # @chikumiku/service-content-store
│   ├── content-ingestion/   # @chikumiku/service-content-ingestion
│   ├── pronunciation/       # @chikumiku/service-pronunciation
│   ├── grammar/             # @chikumiku/service-grammar
│   ├── comprehension/       # @chikumiku/service-comprehension
│   ├── sync/                # @chikumiku/service-sync
│   └── api/                 # @chikumiku/service-api
├── platform-contracts/      # @chikumiku/platform-contracts (interfaces only)
├── platform-web/            # @chikumiku/web-* (browser implementations)
└── platform-mobile/         # @chikumiku/mobile-* (native implementations)
```

## Infrastructure Components

### Compute

| Component | Recommended Service | Purpose |
|-----------|-------------------|---------|
| API Functions | AWS Lambda / Cloud Functions | Serverless request handling |
| API Gateway | AWS API Gateway / Cloud Endpoints | HTTPS routing, rate limiting |
| Background Jobs | AWS Lambda (event-triggered) | Batch analytics, storage migration |

### Storage

| Component | Recommended Service | Purpose |
|-----------|-------------------|---------|
| Primary Database | DynamoDB / Firestore | Learner data, chapters, progress |
| Object Storage | S3 / Cloud Storage | Images, audio assets |
| Cache | ElastiCache (Redis) | Session cache, hot content |
| Message Queue | SQS / Cloud Tasks | Offline sync queue, batch processing |

### Static Assets (User Guide)

| Platform | Delivery Mechanism | Notes |
|----------|-------------------|-------|
| Web | Bundled in web app, cached via localStorage | Auto-cached on first online load |
| Android | Bundled in APK as `assets/user_guide.html` | Always available offline |

### Tiered Storage Configuration

```yaml
storage:
  hot:
    description: "Content accessed within last 30 days"
    class: STANDARD
    performance: high-throughput
  cold:
    description: "Content not accessed for 30+ days"
    class: STANDARD_IA / GLACIER_INSTANT_RETRIEVAL
    migration_trigger: "lastAccessedAt < now() - 30 days"
    
  client_cache:
    max_size_mb: 500
    expiration_days: 7
    eviction_policy: LRU
```

## Build and Package

### Building the Application

```bash
# Install dependencies
npm install

# Build all packages (User Guide HTML + TypeScript)
npm run build

# Run tests to verify
npm run test

# Lint check
npm run lint

# Validate architecture boundaries
npm run validate
```

The `npm run build` command:
1. Runs `build:user-guide` — converts `docs/USER_GUIDE.md` to static HTML at `packages/core/src/helpButton/user-guide.html`
2. Runs `tsc --build` — compiles all packages in dependency-topological order

### Creating Deployment Artifacts

```bash
# Build production bundle
npm run build

# Package each service as a Lambda deployment zip
cd packages/services/auth
zip -r ../../../deploy/auth-lambda.zip dist/ node_modules/ package.json

cd ../api
zip -r ../../../deploy/api-lambda.zip dist/ node_modules/ package.json

cd ../content-ingestion
zip -r ../../../deploy/content-ingestion-lambda.zip dist/ node_modules/ package.json

# Repeat for each service package under packages/services/
```

### Packaging the User Guide for Android

The build script generates `packages/core/src/helpButton/user-guide.html`. For Android deployment:

```bash
# Copy the generated HTML to the Android assets directory
cp packages/core/src/helpButton/user-guide.html android/app/src/main/assets/user_guide.html
```

This step should be part of the Android build pipeline to ensure the latest guide is always bundled.

> **Why Lambda over containers?** The platform's requirements (scale-to-zero at < 10 users, auto-scale to 1000+ concurrent learners, cost efficiency) align perfectly with serverless. Lambda eliminates idle compute costs, handles scaling automatically, and removes container orchestration overhead. The per-function deployment model also matches our Subject Module architecture — each module deploys independently as its own Lambda.

## Environment Configuration

### Required Environment Variables

```bash
# Authentication
JWT_SECRET=<secure-random-string>
JWT_EXPIRY_DAYS=30
SESSION_MIN_DURATION_DAYS=30

# Database
DATABASE_URL=<connection-string>
DATABASE_REGION=<aws-region>

# Object Storage
STORAGE_BUCKET=<bucket-name>
STORAGE_REGION=<aws-region>

# Cache
REDIS_URL=<redis-connection-string>
CACHE_TTL_SECONDS=604800  # 7 days

# Message Queue
QUEUE_URL=<sqs-queue-url>

# OCR / Text Extraction
OCR_SERVICE_ENDPOINT=<ocr-api-url>
OCR_API_KEY=<api-key>

# Image Processing
MAX_IMAGE_SIZE_MB=10
COMPRESSED_IMAGE_MAX_MB=1

# Scaling
MAX_CONCURRENT_LEARNERS=1000
OFFLINE_QUEUE_MAX_ACTIONS=50

# Notifications
NOTIFICATION_SERVICE_URL=<notification-endpoint>
SMTP_HOST=<email-host>
SMTP_PORT=587
```

### Per-Environment Overrides

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=<local-or-dev-db>

# Staging
NODE_ENV=staging
LOG_LEVEL=info

# Production
NODE_ENV=production
LOG_LEVEL=warn
```

## Deployment Procedures

### Initial Deployment

1. **Provision Infrastructure**

```bash
# Using Terraform (example)
cd infrastructure/
terraform init
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

2. **Deploy Database Schema**

```bash
# Run migrations
npm run db:migrate -- --env production
```

3. **Deploy Application**

```bash
# Deploy Lambda functions
aws lambda update-function-code \
  --function-name chikumiku-service-auth \
  --zip-file fileb://deploy/auth-lambda.zip

aws lambda update-function-code \
  --function-name chikumiku-service-api \
  --zip-file fileb://deploy/api-lambda.zip
```

4. **Configure API Gateway**

```bash
# Deploy API Gateway stage
aws apigateway create-deployment \
  --rest-api-id <api-id> \
  --stage-name production
```

5. **Deploy Subject Modules**

```bash
# Each subject module is deployed independently
aws lambda update-function-code \
  --function-name chikumiku-module-kannada \
  --zip-file fileb://deploy/module-kannada.zip
```

### Zero-Downtime Updates

The platform supports zero-downtime deployments:

1. **Blue-Green Deployment**
   - Deploy new version to "green" environment
   - Run smoke tests against green
   - Switch traffic from blue to green via API Gateway
   - Keep blue running for rollback (minimum 30 minutes)

2. **Lambda Versioning**
   ```bash
   # Publish new version
   aws lambda publish-version --function-name chikumiku-service-api
   
   # Update alias to point to new version (weighted routing)
   aws lambda update-alias \
     --function-name chikumiku-service-api \
     --name production \
     --function-version <new-version> \
     --routing-config AdditionalVersionWeights={"<old-version>"=0.1}
   ```

3. **Canary Releases**
   - Route 10% of traffic to new version
   - Monitor error rates and latency
   - Gradually increase to 100% over 30 minutes
   - Auto-rollback if error rate exceeds 1%

### Adding a New Subject Module

Subject Modules are deployed independently without touching core services:

```bash
# 1. Build the module
cd modules/new-subject/
npm run build

# 2. Package
zip -r deploy/module-new-subject.zip dist/ package.json

# 3. Deploy as new Lambda
aws lambda create-function \
  --function-name chikumiku-module-new-subject \
  --runtime nodejs18.x \
  --handler index.handler \
  --zip-file fileb://deploy/module-new-subject.zip

# 4. Register in Subject Module Registry
# (via API call or database entry)
curl -X POST https://api.chikumiku.app/admin/modules \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"subjectId": "new-subject", "name": "New Subject", ...}'
```

### Updating the User Guide

When `docs/USER_GUIDE.md` is updated:

1. Run `npm run build:user-guide` to regenerate the static HTML
2. The web app automatically picks up the new HTML on next deployment
3. For Android, copy the updated HTML to the APK assets and publish a new app version
4. Web users receive the updated guide on their next online visit (cache is replaced)

## Scaling Configuration

### Auto-Scaling Rules

```yaml
scaling:
  # Scale down to minimal when idle
  min_instances: 0
  max_instances: 100
  
  # Scale up thresholds
  scale_up:
    concurrent_requests: 50
    cpu_utilization: 70%
    response_time_p95: 1500ms
  
  # Scale down thresholds  
  scale_down:
    concurrent_learners: 10
    idle_duration: 5m

  # Capacity limits
  max_concurrent_learners: 1000
  p95_response_time_target: 2000ms
```

### Lambda Configuration

```yaml
functions:
  service-auth:
    memory: 256MB
    timeout: 10s
    reserved_concurrency: 50
    
  service-content-ingestion:
    memory: 512MB
    timeout: 30s  # OCR processing
    reserved_concurrency: 100
    
  service-comprehension:
    memory: 512MB
    timeout: 15s  # Answer generation
    reserved_concurrency: 100
    
  service-sync:
    memory: 256MB
    timeout: 5s
    reserved_concurrency: 200
```

### Queue Processing

```yaml
queues:
  offline_sync:
    visibility_timeout: 30s
    max_receive_count: 3
    dead_letter_queue: chikumiku-dlq
    
  batch_analytics:
    delay_seconds: 0
    max_processing_delay: 86400  # 24 hours
    batch_size: 10
```

## Monitoring and Observability

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (P95) | < 2s | > 3s |
| Error Rate | < 0.5% | > 1% |
| Service Availability | 99.5% | < 99% |
| Sync Latency | < 5s | > 10s |
| OCR Processing Time | < 10s | > 15s |
| Concurrent Learners | — | > 900 (capacity warning) |
| User Guide Load Time | < 2s | > 3s |

### Health Checks

```bash
# API health endpoint
GET /health
Response: { "status": "healthy", "version": "1.0.0", "uptime": "..." }

# Deep health check (includes dependencies)
GET /health/deep
Response: { "database": "ok", "cache": "ok", "storage": "ok", "queue": "ok" }
```

### Logging

```yaml
logging:
  format: JSON
  level: warn  # production
  fields:
    - timestamp
    - requestId
    - learnerId (hashed)
    - service
    - action
    - duration
    - statusCode
```

### Alerting

Configure alerts for:
- Service availability drops below 99.5%
- P95 response time exceeds 2 seconds
- Error rate exceeds 1%
- Database connection pool exhaustion
- Storage capacity approaching limits
- Queue depth exceeding 1000 messages
- Failed deployments

## Security

### Authentication

- JWT tokens with platform-agnostic standards
- Tokens issued per-session, minimum 30-day validity
- Refresh token rotation on each use
- Account lockout after 3 failed attempts (15 minutes)

### Data Isolation

- Multi-tenant with logical isolation per learner
- No learner can access another learner's data via any API
- Database queries always scoped by `learnerId`
- Object storage paths include learner ID prefix

### Network Security

- HTTPS only (TLS 1.2+)
- API Gateway with rate limiting
- WAF rules for common attack patterns
- VPC isolation for backend services

### Data Protection

- Passwords hashed with bcrypt (cost factor 12+)
- PII encrypted at rest
- Backups encrypted
- 7-day local backup retention (auto-purge)

## Maintenance

### Scheduled Maintenance

- Maximum 4 hours per month
- Pre-announced to users
- Performed during lowest-traffic periods
- Active sessions preserved across maintenance windows

### Storage Migration Job

Runs daily to migrate content between storage tiers:

```bash
# Cron: Daily at 2:00 AM UTC
0 2 * * * /opt/scripts/storage-migration.sh
```

Logic:
- Content with `lastAccessedAt` > 30 days ago → move to cold storage
- Content accessed within 30 days → ensure in hot storage

### Backup Strategy

```yaml
backups:
  database:
    frequency: continuous (point-in-time recovery)
    retention: 35 days
    cross_region: true
    
  object_storage:
    versioning: enabled
    lifecycle:
      transition_to_glacier: 90 days
      expiration: 365 days
      
  configuration:
    frequency: on-change
    storage: version-controlled repository
```

### Capacity Planning

| Metric | Per 1000 Learners | Notes |
|--------|-------------------|-------|
| Database Storage | ~50 GB | Chapters + progress |
| Object Storage | ~500 GB | Images (compressed to 1 MB each) |
| Cache Memory | ~2 GB | Active sessions + hot content |
| Compute (peak) | ~100 Lambda invocations/sec | During school hours |

## Rollback Procedures

### Application Rollback

```bash
# Revert Lambda to previous version
aws lambda update-alias \
  --function-name chikumiku-service-api \
  --name production \
  --function-version <previous-version>

# Revert API Gateway deployment
aws apigateway update-stage \
  --rest-api-id <api-id> \
  --stage-name production \
  --patch-operations op=replace,path=/deploymentId,value=<previous-deployment-id>
```

### Database Rollback

```bash
# Point-in-time recovery
aws dynamodb restore-table-to-point-in-time \
  --source-table-name chikumiku-learners \
  --target-table-name chikumiku-learners-restored \
  --restore-date-time <timestamp>
```

### Incident Response

1. **Detect**: Automated alerts trigger on threshold breach
2. **Assess**: Check health endpoints and error logs
3. **Mitigate**: Rollback if deployment-related; scale up if capacity-related
4. **Communicate**: Update status page if user-facing impact
5. **Resolve**: Fix root cause, deploy fix through normal pipeline
6. **Review**: Post-incident review within 48 hours

## CI Pipeline Integration

The CI pipeline validates architecture integrity before deployment:

```yaml
steps:
  - name: Validate naming conventions
    run: npm run validate:naming
    
  - name: Validate dependency boundaries
    run: npm run validate:boundaries
    
  - name: Build (includes User Guide generation)
    run: npm run build
    
  - name: Test
    run: npm run test
    
  - name: Lint
    run: npm run lint
    
  - name: Package and deploy
    run: ./scripts/deploy.sh
```

The `validate:boundaries` step ensures no service package imports from web/mobile packages, and no cross-platform imports exist between web and mobile layers.

## Compliance and SLA

| Requirement | Target |
|-------------|--------|
| Availability | 99.5% monthly |
| Maintenance Windows | ≤ 4 hours/month, pre-announced |
| API Response (P95) | < 2 seconds |
| User Guide Load Time | < 2 seconds |
| Sync Latency | < 5 seconds (conflict-free) |
| Zero-Downtime Deploys | Required for all updates |
| Data Isolation | Logical per-learner, no cross-access |
| Horizontal Scaling | 1000+ concurrent learners |
