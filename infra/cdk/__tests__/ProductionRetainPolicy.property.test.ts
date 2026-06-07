/**
 * Property Test: Production Resources Use RETAIN Removal Policy
 *
 * Feature: infra-migration-to-cdk, Property 6
 *
 * For any DynamoDB table, S3 bucket, or CloudWatch log group in the prod
 * environment, the CloudFormation DeletionPolicy SHALL be set to "Retain".
 * This ensures stateful production resources are never accidentally destroyed
 * during stack updates or deletions.
 *
 * **Validates: Requirements 7.6, 8.5, 9.4**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { LearnVerseStack } from '../lib/LearnVerseStack';

/**
 * Resource types that MUST have Retain deletion policy in production.
 */
const RETAIN_RESOURCE_TYPES = [
  'AWS::DynamoDB::Table',
  'AWS::S3::Bucket',
  'AWS::Logs::LogGroup',
];

interface RetainableResource {
  logicalId: string;
  type: string;
  deletionPolicy: string | undefined;
  stackName: string;
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

  for (const child of stack.node.children) {
    visit(child);
  }

  return stacks;
}

/**
 * Extracts all resources of the specified types from all nested stack templates,
 * including their DeletionPolicy.
 */
function extractRetainableResources(stack: cdk.Stack): RetainableResource[] {
  const resources: RetainableResource[] = [];
  const nestedStacks = getAllNestedStacks(stack);

  for (const nestedStack of nestedStacks) {
    const template = (nestedStack as any)._toCloudFormation();
    const cfnResources = template.Resources || {};
    const stackName = nestedStack.node.id;

    for (const [logicalId, resource] of Object.entries(cfnResources)) {
      const res = resource as any;
      const resourceType: string = res.Type;

      if (RETAIN_RESOURCE_TYPES.includes(resourceType)) {
        resources.push({
          logicalId,
          type: resourceType,
          deletionPolicy: res.DeletionPolicy,
          stackName,
        });
      }
    }
  }

  return resources;
}

describe('Property 6: Production Resources Use RETAIN Removal Policy', () => {
  let prodRetainableResources: RetainableResource[];

  beforeAll(() => {
    const app = new cdk.App();

    const prodStack = new LearnVerseStack(app, 'LearnVerseStack-prod', {
      stageName: 'prod',
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    prodRetainableResources = extractRetainableResources(prodStack);
  });

  it('all DynamoDB tables, S3 buckets, and CloudWatch log groups in prod have DeletionPolicy: Retain', () => {
    // Sanity check: we should find at least 3 tables + 2 buckets + 4 log groups = 9 resources
    expect(prodRetainableResources.length).toBeGreaterThanOrEqual(9);

    fc.assert(
      fc.property(
        fc.constantFrom(...prodRetainableResources),
        (resource) => {
          expect(
            resource.deletionPolicy,
            `${resource.type} "${resource.logicalId}" in ${resource.stackName} should have DeletionPolicy "Retain" but has "${resource.deletionPolicy}"`,
          ).toBe('Retain');
        },
      ),
      { numRuns: 100 },
    );
  });
});
