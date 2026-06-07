/**
 * Property Test: Resource Naming Convention Guarantees Environment Isolation
 *
 * Feature: infra-migration-to-cdk, Property 1
 *
 * For any resource provisioned by the LearnVerseStack, if it has a user-defined
 * physical name, that name SHALL match the pattern `learnverse-{stageName}-{resourceSuffix}`.
 * As a consequence, for any two environments (qa, prod), no physical resource name in
 * one environment SHALL collide with a physical resource name in the other.
 *
 * **Validates: Requirements 1.6, 5.6**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { LearnVerseStack } from '../lib/LearnVerseStack';

/**
 * Maps CloudFormation resource types to the property that holds
 * the user-defined physical name.
 */
const RESOURCE_TYPE_NAME_PROPERTY: Record<string, string> = {
  'AWS::DynamoDB::Table': 'TableName',
  'AWS::Cognito::UserPool': 'UserPoolName',
  'AWS::Cognito::UserPoolClient': 'ClientName',
  'AWS::Lambda::Function': 'FunctionName',
  'AWS::ApiGateway::RestApi': 'Name',
  'AWS::S3::Bucket': 'BucketName',
  'AWS::SNS::Topic': 'TopicName',
  'AWS::CloudWatch::Dashboard': 'DashboardName',
  'AWS::CloudWatch::Alarm': 'AlarmName',
  'AWS::Logs::LogGroup': 'LogGroupName',
  'AWS::ApiGateway::Authorizer': 'Name',
};

/**
 * Extracts all user-defined physical names from all templates in a cloud assembly
 * that belong to a given stack name prefix.
 */
function extractPhysicalNamesFromAssembly(assembly: cdk.cx_api.CloudAssembly, stackPrefix: string): string[] {
  const names: string[] = [];

  // Get all stack artifacts (including nested stacks)
  for (const artifact of assembly.artifacts) {
    if (artifact instanceof cdk.cx_api.CloudFormationStackArtifact) {
      // Match the root stack and its nested stacks
      if (artifact.stackName.startsWith(stackPrefix) || artifact.displayName?.includes(stackPrefix)) {
        extractNamesFromTemplate(artifact.template, names);
      }
    }
  }

  return names;
}

/**
 * Extracts user-defined physical names from a CloudFormation template JSON.
 */
function extractNamesFromTemplate(template: Record<string, any>, names: string[]): void {
  const resources = template.Resources || {};

  for (const [, resource] of Object.entries(resources)) {
    const res = resource as any;
    const resourceType: string = res.Type;
    const nameProperty = RESOURCE_TYPE_NAME_PROPERTY[resourceType];

    if (!nameProperty) continue;

    const properties = res.Properties || {};
    const nameValue = properties[nameProperty];

    if (typeof nameValue === 'string') {
      names.push(nameValue);
    }
  }
}

/**
 * Recursively collects all nested stacks and extracts physical names
 * using the construct tree directly (avoids Template.fromStack cyclic check).
 */
function extractPhysicalNamesFromStack(stack: cdk.Stack): string[] {
  const names: string[] = [];
  const stacks = getAllNestedStacks(stack);

  for (const s of stacks) {
    // Use _toCloudFormation() to get raw template without cyclic dep check
    const template = (s as any)._toCloudFormation();
    extractNamesFromTemplate(template, names);
  }

  return names;
}

/**
 * Recursively collects all nested stacks from the construct tree.
 */
function getAllNestedStacks(stack: cdk.Stack): cdk.Stack[] {
  const stacks: cdk.Stack[] = [];

  function visit(construct: IConstruct): void {
    if (construct instanceof cdk.NestedStack) {
      stacks.push(construct);
    }
    for (const child of construct.node.children) {
      visit(child);
    }
  }

  // Visit only children of the root stack (not the root itself since it just has nested stack refs)
  for (const child of stack.node.children) {
    visit(child);
  }

  return stacks;
}

describe('Property 1: Resource Naming Convention Guarantees Environment Isolation', () => {
  let qaNames: string[];
  let prodNames: string[];

  beforeAll(() => {
    const app = new cdk.App();

    const qaStack = new LearnVerseStack(app, 'LearnVerseStack-qa', {
      stageName: 'qa',
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    const prodStack = new LearnVerseStack(app, 'LearnVerseStack-prod', {
      stageName: 'prod',
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    qaNames = extractPhysicalNamesFromStack(qaStack);
    prodNames = extractPhysicalNamesFromStack(prodStack);
  });

  it('every user-defined physical name in QA matches learnverse-qa-{suffix} pattern', () => {
    // Verify we found resources (sanity check)
    expect(qaNames.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...qaNames),
        (name) => {
          // Names must start with learnverse-qa- (for flat names)
          // or /aws/lambda/learnverse-qa- (for log group names)
          // or /aws/apigateway/learnverse-qa- (for API GW log groups)
          const isStandardName = name.startsWith('learnverse-qa-');
          const isLogGroupName = name.startsWith('/aws/lambda/learnverse-qa-') ||
                                 name.startsWith('/aws/apigateway/learnverse-qa-');

          expect(
            isStandardName || isLogGroupName,
            `QA resource name "${name}" does not follow naming convention learnverse-qa-{suffix}`
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every user-defined physical name in Prod matches learnverse-prod-{suffix} pattern', () => {
    // Verify we found resources (sanity check)
    expect(prodNames.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...prodNames),
        (name) => {
          const isStandardName = name.startsWith('learnverse-prod-');
          const isLogGroupName = name.startsWith('/aws/lambda/learnverse-prod-') ||
                                 name.startsWith('/aws/apigateway/learnverse-prod-');

          expect(
            isStandardName || isLogGroupName,
            `Prod resource name "${name}" does not follow naming convention learnverse-prod-{suffix}`
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no physical resource name in QA collides with any physical name in Prod', () => {
    // Build sets for efficient lookup
    const qaNameSet = new Set(qaNames);
    const prodNameSet = new Set(prodNames);

    // Sanity check: both environments have resources
    expect(qaNameSet.size).toBeGreaterThan(0);
    expect(prodNameSet.size).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...qaNames),
        (qaName) => {
          expect(
            prodNameSet.has(qaName),
            `Resource name "${qaName}" exists in BOTH QA and Prod - isolation violation`
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...prodNames),
        (prodName) => {
          expect(
            qaNameSet.has(prodName),
            `Resource name "${prodName}" exists in BOTH Prod and QA - isolation violation`
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
