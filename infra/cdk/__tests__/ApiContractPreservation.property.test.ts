/**
 * Property Test: API Contract Preservation
 *
 * Property 5: Every non-OPTIONS API Gateway Method in the synthesized template
 * SHALL have a valid AWS_PROXY Lambda integration, and the API Gateway Resource
 * hierarchy SHALL form valid path chains from root to leaf.
 *
 * **Validates: Requirements 3.9**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';
import { ComputeStack } from '../lib/ComputeStack';

interface ApiMethod {
  logicalId: string;
  httpMethod: string;
  resourceRef: string;
  authorizationType: string;
  integrationType: string | undefined;
}

interface ApiResource {
  logicalId: string;
  pathPart: string;
  parentRef: string | undefined;
}

/**
 * Routes that are publicly accessible (no auth required).
 * These correspond to publicMethodOptions routes in ApiStack.
 */
const PUBLIC_PATHS = [
  '/auth/register/parent',
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/verify-otp',
  '/auth/reset-password',
];

describe('Property 5: API Contract Preservation', () => {
  let apiTemplate: Template;
  let methods: ApiMethod[];
  let resources: ApiResource[];
  let resourceMap: Map<string, ApiResource>;

  beforeAll(() => {
    const app = new cdk.App();
    const parentStack = new cdk.Stack(app, 'TestStack');

    // Create mock dependencies (PostgreSQL-based)
    const userPool = new cognito.UserPool(parentStack, 'UserPool');
    const userPoolClient = new cognito.UserPoolClient(parentStack, 'UserPoolClient', {
      userPool,
    });

    const vpc = new ec2.Vpc(parentStack, 'Vpc', { maxAzs: 2 });
    const lambdaSecurityGroup = new ec2.SecurityGroup(parentStack, 'LambdaSG', {
      vpc,
      securityGroupName: 'learnverse-test-lambda-sg',
    });

    const dbCluster = new rds.DatabaseCluster(parentStack, 'PostgresCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      defaultDatabaseName: 'learnverse',
    });

    const contentBucket = new s3.Bucket(parentStack, 'ContentBucket', {
      bucketName: 'learnverse-test-content-bucket',
    });

    // Create ComputeStack (PostgreSQL-connected Lambda functions)
    const computeStack = new ComputeStack(parentStack, 'ComputeStack', {
      stageName: 'test',
      vpc,
      lambdaSecurityGroup,
      dbCluster,
      contentBucket,
      userPool,
      userPoolClientId: userPoolClient.userPoolClientId,
    });

    // Create ApiStack with the functions from ComputeStack
    const apiStack = new ApiStack(parentStack, 'ApiStack', {
      stageName: 'test',
      userPool,
      functions: computeStack.functions,
    });

    apiTemplate = Template.fromStack(apiStack);

    // Extract all API Gateway Methods
    const rawMethods = apiTemplate.findResources('AWS::ApiGateway::Method');
    methods = Object.entries(rawMethods).map(([logicalId, resource]) => {
      const props = (resource as any).Properties;
      // ResourceId can be a Ref or Fn::GetAtt
      let resourceRef = '';
      if (props.ResourceId?.Ref) {
        resourceRef = props.ResourceId.Ref;
      } else if (props.ResourceId?.['Fn::GetAtt']) {
        resourceRef = '__ROOT__';
      }
      return {
        logicalId,
        httpMethod: props.HttpMethod,
        resourceRef,
        authorizationType: props.AuthorizationType || 'NONE',
        integrationType: props.Integration?.Type,
      };
    });

    // Extract all API Gateway Resources
    const rawResources = apiTemplate.findResources('AWS::ApiGateway::Resource');
    resources = Object.entries(rawResources).map(([logicalId, resource]) => {
      const props = (resource as any).Properties;
      let parentRef: string | undefined;
      if (props.ParentId?.Ref) {
        parentRef = props.ParentId.Ref;
      } else if (props.ParentId?.['Fn::GetAtt']) {
        parentRef = '__ROOT__';
      }
      return {
        logicalId,
        pathPart: props.PathPart,
        parentRef,
      };
    });

    resourceMap = new Map(resources.map((r) => [r.logicalId, r]));
  });

  /**
   * Resolves a resource's full path by walking up the parent chain.
   */
  function resolveFullPath(resourceRef: string): string {
    if (resourceRef === '__ROOT__' || !resourceRef) return '/';
    const resource = resourceMap.get(resourceRef);
    if (!resource) return '/<unknown>';

    const segments: string[] = [resource.pathPart];
    let current = resource;
    while (current.parentRef && current.parentRef !== '__ROOT__') {
      const parent = resourceMap.get(current.parentRef);
      if (!parent) break;
      segments.unshift(parent.pathPart);
      current = parent;
    }
    return '/' + segments.join('/');
  }

  it('every non-OPTIONS API Gateway Method has a valid AWS_PROXY Lambda integration', () => {
    const nonOptionsMethods = methods.filter((m) => m.httpMethod !== 'OPTIONS');

    // Sanity: we should have a substantial number of API methods
    expect(nonOptionsMethods.length).toBeGreaterThanOrEqual(30);

    fc.assert(
      fc.property(
        fc.constantFrom(...nonOptionsMethods),
        (method) => {
          expect(
            method.integrationType,
            `Method ${method.httpMethod} on resource ${method.resourceRef} (${method.logicalId}) should have AWS_PROXY integration but has "${method.integrationType}"`,
          ).toBe('AWS_PROXY');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('every API Gateway Resource has a valid parent chain resolving to root', () => {
    // Every resource should be able to trace its parent chain back to __ROOT__
    expect(resources.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...resources),
        (resource) => {
          const visited = new Set<string>();
          let current: ApiResource | undefined = resource;

          while (current) {
            // Prevent infinite loops
            if (visited.has(current.logicalId)) {
              expect.fail(`Circular parent reference detected for resource ${current.logicalId}`);
            }
            visited.add(current.logicalId);

            if (!current.parentRef || current.parentRef === '__ROOT__') {
              // Successfully traced to root
              return;
            }
            current = resourceMap.get(current.parentRef);
          }

          // If we get here, the parent chain is broken
          expect.fail(
            `Resource "${resource.pathPart}" (${resource.logicalId}) has broken parent chain`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('protected routes use COGNITO_USER_POOLS auth and public routes use NONE', () => {
    const nonOptionsMethods = methods.filter((m) => m.httpMethod !== 'OPTIONS');

    fc.assert(
      fc.property(
        fc.constantFrom(...nonOptionsMethods),
        (method) => {
          const fullPath = resolveFullPath(method.resourceRef);
          const isPublicRoute = PUBLIC_PATHS.some((p) => fullPath === p);

          if (isPublicRoute) {
            expect(
              method.authorizationType,
              `Public route ${method.httpMethod} ${fullPath} should have NONE auth`,
            ).toBe('NONE');
          } else {
            expect(
              method.authorizationType,
              `Protected route ${method.httpMethod} ${fullPath} should have COGNITO_USER_POOLS auth but has "${method.authorizationType}"`,
            ).toBe('COGNITO_USER_POOLS');
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
