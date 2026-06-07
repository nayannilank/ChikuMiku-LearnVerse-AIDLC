import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/StorageStack';

describe('StorageStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaStorageStack = new StorageStack(qaParent, 'StorageStack', {
      stageName: 'qa',
    });
    qaTemplate = Template.fromStack(qaStorageStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodStorageStack = new StorageStack(prodParent, 'StorageStack', {
      stageName: 'prod',
    });
    prodTemplate = Template.fromStack(prodStorageStack);
  });

  describe('Content Bucket Public Access Block (Requirement 9.1)', () => {
    it('blocks all public access on content bucket', () => {
      qaTemplate.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: Match.anyValue(),
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });
  });

  describe('Content Bucket CORS Rules (Requirement 9.2)', () => {
    it('allows GET and PUT methods from all origins with 3600s maxAge', () => {
      qaTemplate.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: Match.arrayWith(['GET', 'PUT']),
              AllowedOrigins: ['*'],
              MaxAge: 3600,
            },
          ],
        },
      });
    });
  });

  describe('Content Bucket Lifecycle Transitions (Requirement 9.3)', () => {
    it('transitions to STANDARD_IA after 30 days and GLACIER_INSTANT_RETRIEVAL after 90 days', () => {
      qaTemplate.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Status: 'Enabled',
              Transitions: Match.arrayWith([
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 30,
                },
                {
                  StorageClass: 'GLACIER_IR',
                  TransitionInDays: 90,
                },
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('Content Bucket Removal Policy (Requirement 9.4)', () => {
    it('sets DESTROY removal policy for content bucket in qa', () => {
      qaTemplate.hasResource('AWS::S3::Bucket', {
        Properties: {
          CorsConfiguration: Match.anyValue(),
          LifecycleConfiguration: Match.anyValue(),
        },
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    it('sets RETAIN removal policy for content bucket in prod', () => {
      prodTemplate.hasResource('AWS::S3::Bucket', {
        Properties: {
          CorsConfiguration: Match.anyValue(),
          LifecycleConfiguration: Match.anyValue(),
        },
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });
});
