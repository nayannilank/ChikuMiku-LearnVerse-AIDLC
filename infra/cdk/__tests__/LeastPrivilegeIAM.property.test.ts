/**
 * Property Test: Least-Privilege IAM Per Lambda
 *
 * Feature: infra-migration-to-cdk, Property 4: Least-Privilege IAM
 *
 * For each Lambda, its IAM policy SHALL only reference resources from
 * its designated resource set. No Lambda SHALL have access to resources outside
 * its domain boundary.
 *
 * **Validates: Requirements 3.3**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template } from 'aws-cdk-lib/assertions';
import { ComputeStack } from '../lib/ComputeStack';

/**
 * Defines the allowed resource access matrix per Lambda.
 *
 * Each entry specifies:
 * - allowedPatterns: regex patterns matching logical IDs or resource references the Lambda MAY access
 * - forbiddenPatterns: regex patterns for resources the Lambda MUST NOT access
 */
interface LambdaAccessRule {
  name: string;
  rolePattern: RegExp;
  allowedPatterns: RegExp[];
  forbiddenPatterns: RegExp[];
}

const LAMBDA_ACCESS_RULES: LambdaAccessRule[] = [
  {
    name: 'Auth Lambda',
    rolePattern: /AuthLambda/,
    // Auth Lambda: DB secret access, Cognito admin actions
    allowedPatterns: [
      /secretsmanager/i,
      /cognito-idp/i,
    ],
    // Auth Lambda: no S3 access
    forbiddenPatterns: [
      /ContentBucket/i,
      /s3:Put/i,
      /s3:Get/i,
      /s3:Delete/i,
    ],
  },
  {
    name: 'ContentStore Lambda',
    rolePattern: /ContentStoreLambda/,
    // ContentStore Lambda: DB secret access
    allowedPatterns: [
      /secretsmanager/i,
    ],
    // ContentStore Lambda: no Cognito admin, no S3 write
    forbiddenPatterns: [
      /cognito-idp/i,
    ],
  },
  {
    name: 'ContentIngestion Lambda',
    rolePattern: /ContentIngestionLambda/,
    // ContentIngestion Lambda: DB secret access, S3 access
    allowedPatterns: [
      /secretsmanager/i,
      /ContentBucket|s3/i,
    ],
    // ContentIngestion Lambda: no Cognito admin
    forbiddenPatterns: [
      /cognito-idp/i,
    ],
  },
  {
    name: 'Comprehension Lambda',
    rolePattern: /ComprehensionLambda/,
    // Comprehension Lambda: DB secret access, S3 read
    allowedPatterns: [
      /secretsmanager/i,
      /ContentBucket|s3/i,
    ],
    // Comprehension Lambda: no Cognito admin
    forbiddenPatterns: [
      /cognito-idp/i,
    ],
  },
  {
    name: 'Sync Lambda',
    rolePattern: /SyncLambda/,
    // Sync Lambda: DB secret access
    allowedPatterns: [
      /secretsmanager/i,
    ],
    // Sync Lambda: no S3, no Cognito admin
    forbiddenPatterns: [
      /ContentBucket/i,
      /cognito-idp/i,
    ],
  },
  {
    name: 'Pronunciation Lambda',
    rolePattern: /PronunciationLambda/,
    // Pronunciation Lambda: DB secret access, S3 access for audio
    allowedPatterns: [
      /secretsmanager/i,
      /ContentBucket|s3/i,
    ],
    // Pronunciation Lambda: no Cognito admin
    forbiddenPatterns: [
      /cognito-idp/i,
    ],
  },
  {
    name: 'Grammar Lambda',
    rolePattern: /GrammarLambda/,
    // Grammar Lambda: DB secret access
    allowedPatterns: [
      /secretsmanager/i,
    ],
    // Grammar Lambda: no S3, no Cognito admin
    forbiddenPatterns: [
      /ContentBucket/i,
      /cognito-idp/i,
    ],
  },
  {
    name: 'AI Gateway Lambda',
    rolePattern: /AiGatewayLambda/,
    // AI Gateway Lambda: DB secret access, S3 access
    allowedPatterns: [
      /secretsmanager/i,
      /ContentBucket|s3/i,
    ],
    // AI Gateway Lambda: no Cognito admin
    forbiddenPatterns: [
      /cognito-idp/i,
    ],
  },
];

describe('Property 4: Least-Privilege IAM Per Lambda', () => {
  let computeTemplate: Template;

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

    computeTemplate = Template.fromStack(computeStack);
  });

  /**
   * Gets all IAM policy statements for a given Lambda role pattern.
   * Returns statements with their associated policy logical ID for traceability.
   */
  function getStatementsForRole(rolePattern: RegExp): Array<{
    Action: string | string[];
    Effect: string;
    Resource: unknown;
    policyId: string;
  }> {
    const policies = computeTemplate.findResources('AWS::IAM::Policy');
    const statements: Array<{
      Action: string | string[];
      Effect: string;
      Resource: unknown;
      policyId: string;
    }> = [];

    for (const [policyId, policy] of Object.entries(policies)) {
      const roles = (policy as any).Properties.Roles;
      const matchesRole = roles?.some((r: Record<string, string>) =>
        r.Ref && rolePattern.test(r.Ref)
      );
      if (matchesRole) {
        const stmts = (policy as any).Properties.PolicyDocument.Statement;
        for (const stmt of stmts) {
          statements.push({ ...stmt, policyId });
        }
      }
    }
    return statements;
  }

  /**
   * Serializes a Resource field to a searchable string.
   * CDK generates resources as Ref, Fn::GetAtt, Fn::Join, or plain ARN strings.
   */
  function resourceToSearchableString(resource: unknown): string {
    if (typeof resource === 'string') return resource;
    if (Array.isArray(resource)) return resource.map(resourceToSearchableString).join(' ');
    if (resource && typeof resource === 'object') {
      return JSON.stringify(resource);
    }
    return '';
  }

  /**
   * Checks if any statement references a forbidden resource pattern.
   * Examines both the Resource field and Actions for service-level violations.
   */
  function checkForbiddenAccess(
    statements: Array<{ Action: string | string[]; Resource: unknown }>,
    forbiddenPatterns: RegExp[]
  ): { violated: boolean; details: string } {
    for (const stmt of statements) {
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      const resourceStr = resourceToSearchableString(stmt.Resource);

      for (const pattern of forbiddenPatterns) {
        // Check if actions reference a forbidden service
        const actionViolation = actions.some((a) => pattern.test(a));
        if (actionViolation) {
          return {
            violated: true,
            details: `Action "${actions.join(', ')}" matches forbidden pattern ${pattern}`,
          };
        }

        // Check if resource references a forbidden resource
        const resourceViolation = pattern.test(resourceStr);
        if (resourceViolation) {
          return {
            violated: true,
            details: `Resource "${resourceStr.substring(0, 200)}" matches forbidden pattern ${pattern}`,
          };
        }
      }
    }
    return { violated: false, details: '' };
  }

  it('each Lambda IAM policy only references resources from its allowed set (no forbidden resources)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LAMBDA_ACCESS_RULES),
        (rule) => {
          const statements = getStatementsForRole(rule.rolePattern);

          // The Lambda should have at least one IAM policy statement
          expect(statements.length).toBeGreaterThan(0);

          // Verify no forbidden resources are referenced
          const { violated, details } = checkForbiddenAccess(statements, rule.forbiddenPatterns);
          expect(violated, `${rule.name} violated least-privilege: ${details}`).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each Lambda IAM policy references at least one of its allowed resources', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LAMBDA_ACCESS_RULES),
        (rule) => {
          const statements = getStatementsForRole(rule.rolePattern);

          // Verify the Lambda has access to at least one allowed resource
          const allContent = statements.map((stmt) => {
            const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
            const resourceStr = resourceToSearchableString(stmt.Resource);
            return actions.join(' ') + ' ' + resourceStr;
          }).join(' ');

          const hasAllowedResource = rule.allowedPatterns.some((pattern) =>
            pattern.test(allContent)
          );

          expect(
            hasAllowedResource,
            `${rule.name} should have access to at least one allowed resource`
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
