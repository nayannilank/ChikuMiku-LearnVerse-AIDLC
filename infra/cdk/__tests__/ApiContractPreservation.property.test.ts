/**
 * Property Test: API Contract Preservation
 *
 * Property 5: For any route defined in createDefaultRoutes() (the existing API),
 * there SHALL exist a corresponding API Gateway resource+method in the synthesized
 * template with the correct HTTP method and path pattern.
 *
 * **Validates: Requirements 3.9**
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

describe('Property 5: API Contract Preservation', () => {
  let apiTemplate: Template;
  let allRoutes: ReturnType<typeof createDefaultRoutes>;

  beforeAll(() => {
    const app = new cdk.App();
    const parentStack = new cdk.Stack(app, 'TestStack');

    // Create mock dependencies
    const userPool = new cognito.UserPool(parentStack, 'UserPool');
    const userPoolClient = new cognito.UserPoolClient(parentStack, 'UserPoolClient', {
      userPool,
    });

    const learnersTable = new dynamodb.Table(parentStack, 'LearnersTable', {
      tableName: 'chikumiku-test-learners',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const accountsTable = new dynamodb.Table(parentStack, 'AccountsTable', {
      tableName: 'chikumiku-test-accounts',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentTable = new dynamodb.Table(parentStack, 'ContentTable', {
      tableName: 'chikumiku-test-content',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentBucket = new s3.Bucket(parentStack, 'ContentBucket', {
      bucketName: 'chikumiku-test-content-bucket',
    });

    // Create ApiStack (provides api and authorizer)
    const apiStack = new ApiStack(parentStack, 'ApiStack', {
      stageName: 'test',
      userPool,
    });

    // Create LambdaStack (wires methods to api resources)
    new LambdaStack(parentStack, 'LambdaStack', {
      stageName: 'test',
      tables: { learnersTable, accountsTable, contentTable },
      contentBucket,
      api: apiStack.api,
      authorizer: apiStack.authorizer,
      userPool,
      userPoolClientId: userPoolClient.userPoolClientId,
    });

    // API Gateway methods are synthesized in the ApiStack
    apiTemplate = Template.fromStack(apiStack);

    // Get all routes from the source of truth
    allRoutes = createDefaultRoutes();
  });

  it('every route from createDefaultRoutes() has a matching API Gateway Method in the synthesized template', () => {
    // Get all API Gateway methods and resources from the template
    const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
    const resources = apiTemplate.findResources('AWS::ApiGateway::Resource');

    // Build a lookup: resourceLogicalId -> pathPart
    const resourcePathParts: Record<string, string> = {};
    for (const [logicalId, resource] of Object.entries(resources)) {
      resourcePathParts[logicalId] = (resource as any).Properties.PathPart;
    }

    // Build a set of (httpMethod, lastPathSegment) pairs for quick matching
    // We use the last segment + HTTP method as a simplified lookup since
    // API Gateway resources are hierarchical
    const methodEntries: Array<{ httpMethod: string; resourceRef: string }> = [];
    for (const [, method] of Object.entries(methods)) {
      const props = (method as any).Properties;
      if (props.HttpMethod === 'OPTIONS') continue; // Skip CORS preflight
      const resourceRef = props.ResourceId?.Ref || '';
      methodEntries.push({
        httpMethod: props.HttpMethod,
        resourceRef,
      });
    }

    // Use fast-check to sample routes and verify each one
    fc.assert(
      fc.property(
        fc.constantFrom(...allRoutes),
        (route) => {
          const segments = getPathSegments(route.path);
          const lastSegment = segments[segments.length - 1];

          // Find a matching API Gateway method:
          // 1. The HTTP method matches
          // 2. The resource it's attached to has the correct last path part
          const matchingMethod = methodEntries.find((entry) => {
            if (entry.httpMethod !== route.method) return false;
            const pathPart = resourcePathParts[entry.resourceRef];
            return pathPart === lastSegment;
          });

          expect(matchingMethod).toBeDefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('API Gateway path structure matches Express route path segments', () => {
    const resources = apiTemplate.findResources('AWS::ApiGateway::Resource');

    // Collect all path parts defined in the template
    const allPathParts = new Set<string>();
    for (const [, resource] of Object.entries(resources)) {
      allPathParts.add((resource as any).Properties.PathPart);
    }

    // For every route, each path segment should exist as an API Gateway Resource PathPart
    fc.assert(
      fc.property(
        fc.constantFrom(...allRoutes),
        (route) => {
          const segments = getPathSegments(route.path);
          for (const segment of segments) {
            expect(allPathParts.has(segment)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
