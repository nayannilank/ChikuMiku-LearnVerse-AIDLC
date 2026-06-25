/**
 * Property Test: Cognito Authorizer Coverage
 *
 * Property 1: JWT Parsing and Claim Extraction (infrastructure aspect —
 * Cognito authorizer on all routes).
 *
 * Verifies that:
 * 1. A CognitoUserPoolsAuthorizer exists in the synthesized template
 * 2. All non-OPTIONS API Gateway methods that are protected use COGNITO_USER_POOLS
 * 3. Public auth routes use AuthorizationType NONE
 * 4. The vast majority of routes (>=80%) are protected with COGNITO_USER_POOLS
 *
 * **Validates: Requirements 2.5, 2.6**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';

describe('Property 1: Cognito Authorizer Coverage on All Routes', () => {
  let apiTemplate: Template;
  let methodEntries: Array<{
    logicalId: string;
    httpMethod: string;
    authorizationType: string;
    authorizerId: any;
    resourceRef: string;
  }>;
  let protectedMethods: typeof methodEntries;
  let publicMethods: typeof methodEntries;
  let resourcePathParts: Record<string, string>;

  // Known public route path segments (last segment of each public auth route)
  const PUBLIC_PATH_SEGMENTS = new Set([
    'parent',   // /auth/register/parent
    'login',
    'refresh',
    'forgot-password',
    'verify-otp',
    'reset-password',
  ]);

  beforeAll(() => {
    const app = new cdk.App();
    const parentStack = new cdk.Stack(app, 'TestStack');

    // Create Cognito UserPool (required by ApiStack for the authorizer)
    const userPool = new cognito.UserPool(parentStack, 'UserPool');

    // Create mock Lambda functions for all 7 keys expected by ApiStack
    const functionKeys = [
      'auth',
      'content-store',
      'content-ingestion',
      'comprehension',
      'sync',
      'pronunciation',
      'grammar',
    ];

    const functions: Record<string, lambda.Function> = {};
    for (const key of functionKeys) {
      functions[key] = new lambda.Function(parentStack, `MockFn-${key}`, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = () => {}'),
        functionName: `mock-${key}`,
      });
    }

    // Create ApiStack with mock functions
    const apiStack = new ApiStack(parentStack, 'ApiStack', {
      stageName: 'test',
      userPool,
      functions,
    });

    apiTemplate = Template.fromStack(apiStack);

    // Extract all API Gateway resources for path resolution
    const resources = apiTemplate.findResources('AWS::ApiGateway::Resource');
    resourcePathParts = {};
    for (const [logicalId, resource] of Object.entries(resources)) {
      resourcePathParts[logicalId] = (resource as any).Properties.PathPart;
    }

    // Extract all API Gateway methods (excluding OPTIONS/CORS preflight)
    const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
    methodEntries = [];
    for (const [logicalId, method] of Object.entries(methods)) {
      const props = (method as any).Properties;
      if (props.HttpMethod === 'OPTIONS') continue; // Skip CORS preflight
      const resourceRef = props.ResourceId?.Ref || props.ResourceId?.['Fn::GetAtt']?.[0] || '';
      methodEntries.push({
        logicalId,
        httpMethod: props.HttpMethod,
        authorizationType: props.AuthorizationType || 'NONE',
        authorizerId: props.AuthorizerId,
        resourceRef,
      });
    }

    // Partition into protected and public methods
    protectedMethods = methodEntries.filter(
      (m) => m.authorizationType === 'COGNITO_USER_POOLS'
    );
    publicMethods = methodEntries.filter(
      (m) => m.authorizationType === 'NONE'
    );
  });

  it('a CognitoUserPoolsAuthorizer resource exists in the template', () => {
    const authorizers = apiTemplate.findResources('AWS::ApiGateway::Authorizer');
    const authorizerEntries = Object.values(authorizers);

    expect(authorizerEntries.length).toBeGreaterThanOrEqual(1);

    // At least one authorizer should be of type COGNITO_USER_POOLS
    const cognitoAuthorizers = authorizerEntries.filter(
      (a: any) => a.Properties.Type === 'COGNITO_USER_POOLS'
    );
    expect(cognitoAuthorizers.length).toBeGreaterThanOrEqual(1);
  });

  it('every non-OPTIONS method has a valid auth type (COGNITO_USER_POOLS or NONE)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...methodEntries),
        (method) => {
          expect(['COGNITO_USER_POOLS', 'NONE']).toContain(method.authorizationType);
        }
      ),
      { numRuns: Math.min(methodEntries.length * 3, 200) }
    );
  });

  it('all protected methods have an authorizer reference attached', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...protectedMethods),
        (method) => {
          // Protected methods must reference an authorizer
          expect(method.authorizerId).toBeDefined();
        }
      ),
      { numRuns: Math.min(protectedMethods.length * 3, 200) }
    );
  });

  it('public auth routes have AuthorizationType NONE with no authorizer', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...publicMethods),
        (method) => {
          expect(method.authorizationType).toBe('NONE');
          // Public routes should NOT have an authorizer attached
          expect(method.authorizerId).toBeUndefined();
        }
      ),
      { numRuns: Math.min(publicMethods.length * 3, 200) }
    );
  });

  it('at least 80% of non-OPTIONS methods are protected with COGNITO_USER_POOLS', () => {
    const totalMethods = methodEntries.length;
    const protectedCount = protectedMethods.length;
    const protectedRatio = protectedCount / totalMethods;

    expect(protectedRatio).toBeGreaterThanOrEqual(0.8);
  });

  it('at least one method uses COGNITO_USER_POOLS (authorizer is actively used)', () => {
    expect(protectedMethods.length).toBeGreaterThan(0);
  });

  it('public routes correspond to known auth endpoints (register/parent, login, etc.)', () => {
    // Verify that public methods map to expected public path segments
    for (const method of publicMethods) {
      const pathPart = resourcePathParts[method.resourceRef];
      // Each public method's last resource path segment should be one of the known public paths
      expect(PUBLIC_PATH_SEGMENTS.has(pathPart)).toBe(true);
    }
  });

  it('random subsets of protected methods all consistently have COGNITO_USER_POOLS', () => {
    fc.assert(
      fc.property(
        fc.subarray(protectedMethods, { minLength: 1 }),
        (subset) => {
          for (const method of subset) {
            expect(method.authorizationType).toBe('COGNITO_USER_POOLS');
            expect(method.authorizerId).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
