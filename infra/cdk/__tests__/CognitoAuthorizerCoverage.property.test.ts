/**
 * Property Test: Cognito Authorizer Coverage
 *
 * Property 3: Protected Endpoints Require Cognito Authorization
 *
 * For any route marked `requiresAuth: true`, the synthesized API Gateway method
 * SHALL have `AuthorizationType: COGNITO_USER_POOLS` with the Cognito authorizer attached.
 * Conversely, routes with `requiresAuth: false` SHALL have `AuthorizationType: NONE`.
 *
 * **Validates: Requirements 2.8**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';
import { LambdaStack } from '../lib/LambdaStack';
import { createDefaultRoutes } from '../../../packages/services/api/src/endpoints';

/**
 * Converts Express-style path params (`:paramName`) to API Gateway format (`{paramName}`).
 */
function expressToApiGateway(path: string): string {
  return path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, '{$1}');
}

/**
 * Extracts all path segments from a route path, converting param syntax.
 * e.g., '/api/v1/subjects/:subjectId/textbooks' -> ['api', 'v1', 'subjects', '{subjectId}', 'textbooks']
 */
function getPathSegments(path: string): string[] {
  const converted = expressToApiGateway(path);
  return converted.split('/').filter((s) => s.length > 0);
}

describe('Property 3: Protected Endpoints Require Cognito Authorization', () => {
  let apiTemplate: Template;
  let allRoutes: ReturnType<typeof createDefaultRoutes>;
  let protectedRoutes: ReturnType<typeof createDefaultRoutes>;
  let publicRoutes: ReturnType<typeof createDefaultRoutes>;

  // Template lookups
  let methods: Record<string, any>;
  let resources: Record<string, any>;
  let resourcePathParts: Record<string, string>;
  let methodEntries: Array<{
    httpMethod: string;
    resourceRef: string;
    authorizationType: string;
    authorizerId: any;
  }>;

  beforeAll(() => {
    const app = new cdk.App();
    const parentStack = new cdk.Stack(app, 'TestStack');

    // Create mock dependencies
    const userPool = new cognito.UserPool(parentStack, 'UserPool');
    const userPoolClient = new cognito.UserPoolClient(parentStack, 'UserPoolClient', {
      userPool,
    });

    const learnersTable = new dynamodb.Table(parentStack, 'LearnersTable', {
      tableName: 'learnverse-test-learners',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const accountsTable = new dynamodb.Table(parentStack, 'AccountsTable', {
      tableName: 'learnverse-test-accounts',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentTable = new dynamodb.Table(parentStack, 'ContentTable', {
      tableName: 'learnverse-test-content',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentBucket = new s3.Bucket(parentStack, 'ContentBucket', {
      bucketName: 'learnverse-test-content-bucket',
    });

    // Create LambdaStack first (functions only)
    const lambdaStack = new LambdaStack(parentStack, 'LambdaStack', {
      stageName: 'test',
      tables: { learnersTable, accountsTable, contentTable },
      contentBucket,
      userPool,
      userPoolClientId: userPoolClient.userPoolClientId,
    });

    // Create ApiStack with the functions from LambdaStack
    const apiStack = new ApiStack(parentStack, 'ApiStack', {
      stageName: 'test',
      userPool,
      functions: lambdaStack.functions,
    });

    // API Gateway methods are synthesized in the ApiStack
    apiTemplate = Template.fromStack(apiStack);

    // Get all routes from the source of truth
    allRoutes = createDefaultRoutes();
    protectedRoutes = allRoutes.filter((r) => r.requiresAuth === true);
    publicRoutes = allRoutes.filter((r) => r.requiresAuth === false);

    // Build template lookups
    methods = apiTemplate.findResources('AWS::ApiGateway::Method');
    resources = apiTemplate.findResources('AWS::ApiGateway::Resource');

    // Build a lookup: resourceLogicalId -> pathPart
    resourcePathParts = {};
    for (const [logicalId, resource] of Object.entries(resources)) {
      resourcePathParts[logicalId] = (resource as any).Properties.PathPart;
    }

    // Build method entries with auth info
    methodEntries = [];
    for (const [, method] of Object.entries(methods)) {
      const props = (method as any).Properties;
      if (props.HttpMethod === 'OPTIONS') continue; // Skip CORS preflight
      const resourceRef = props.ResourceId?.Ref || '';
      methodEntries.push({
        httpMethod: props.HttpMethod,
        resourceRef,
        authorizationType: props.AuthorizationType || 'NONE',
        authorizerId: props.AuthorizerId,
      });
    }
  });

  it('all routes with requiresAuth: true have AuthorizationType COGNITO_USER_POOLS', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...protectedRoutes),
        (route) => {
          const segments = getPathSegments(route.path);
          const lastSegment = segments[segments.length - 1];

          // Find matching API Gateway method by HTTP method and last path segment
          const matchingMethod = methodEntries.find((entry) => {
            if (entry.httpMethod !== route.method) return false;
            const pathPart = resourcePathParts[entry.resourceRef];
            return pathPart === lastSegment;
          });

          expect(matchingMethod).toBeDefined();
          expect(matchingMethod!.authorizationType).toBe('COGNITO_USER_POOLS');
          expect(matchingMethod!.authorizerId).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all routes with requiresAuth: false have AuthorizationType NONE', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...publicRoutes),
        (route) => {
          const segments = getPathSegments(route.path);
          const lastSegment = segments[segments.length - 1];

          // Find matching API Gateway method by HTTP method and last path segment
          const matchingMethod = methodEntries.find((entry) => {
            if (entry.httpMethod !== route.method) return false;
            const pathPart = resourcePathParts[entry.resourceRef];
            return pathPart === lastSegment;
          });

          expect(matchingMethod).toBeDefined();
          expect(matchingMethod!.authorizationType).toBe('NONE');
          // Public routes should NOT have an authorizer attached
          expect(matchingMethod!.authorizerId).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
