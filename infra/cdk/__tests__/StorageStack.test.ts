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

  describe('CloudFront Distribution HTTPS and HTTP Version (Requirement 10.1)', () => {
    it('redirects viewers to HTTPS', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        }),
      });
    });

    it('enables HTTP/2 and HTTP/3', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          HttpVersion: 'http2and3',
        }),
      });
    });
  });

  describe('CloudFront Distribution OAI and Error Responses (Requirement 10.2)', () => {
    it('creates an Origin Access Identity', () => {
      qaTemplate.hasResourceProperties(
        'AWS::CloudFront::CloudFrontOriginAccessIdentity',
        {
          CloudFrontOriginAccessIdentityConfig: {
            Comment: Match.stringLikeRegexp('OAI for chikumiku-qa-web-app'),
          },
        }
      );
    });

    it('configures custom error responses for 403 and 404 to return index.html', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({
              ErrorCode: 403,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
            Match.objectLike({
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
          ]),
        }),
      });
    });
  });

  describe('CloudFront /api/* Cache Behavior (Requirement 10.3)', () => {
    it('has /api/* path pattern with caching disabled', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
            }),
          ]),
        }),
      });
    });

    it('/api/* behavior uses redirect-to-https viewer protocol', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        }),
      });
    });

    it('/api/* behavior allows all HTTP methods', () => {
      qaTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              AllowedMethods: Match.arrayWith([
                'GET',
                'HEAD',
                'OPTIONS',
                'PUT',
                'PATCH',
                'POST',
                'DELETE',
              ]),
            }),
          ]),
        }),
      });
    });
  });
});
