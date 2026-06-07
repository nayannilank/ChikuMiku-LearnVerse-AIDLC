import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CiCdStack } from '../lib/CiCdStack';

describe('CiCdStack', () => {
  let template: Template;
  const githubRepo = 'NayanKhedkar/LearnVerse-LearnVerse';

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new CiCdStack(app, 'TestCiCdStack', {
      env: { region: 'ap-south-1', account: '123456789012' },
      githubRepo,
    });
    template = Template.fromStack(stack);
  });

  describe('OIDC Provider (Requirement 4.1)', () => {
    it('creates a GitHub Actions OIDC provider', () => {
      template.hasResourceProperties('Custom::AWSCDKOpenIdConnectProvider', {
        Url: 'https://token.actions.githubusercontent.com',
        ClientIDList: ['sts.amazonaws.com'],
      });
    });
  });

  describe('IAM Deploy Role (Requirement 4.1)', () => {
    it('creates an IAM role with the correct name', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'learnverse-github-actions-deploy',
      });
    });

    it('trusts the GitHub Actions OIDC provider with correct conditions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRoleWithWebIdentity',
              Effect: 'Allow',
              Condition: {
                StringEquals: {
                  'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                },
                StringLike: {
                  'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:*`,
                },
              },
            }),
          ]),
        },
      });
    });
  });

  describe('IAM Permissions (Requirement 4.2)', () => {
    it('grants CloudFormation permissions for CDK deploy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'CDKDeploy',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'cloudformation:CreateStack',
                'cloudformation:UpdateStack',
                'cloudformation:DescribeStacks',
                'cloudformation:CreateChangeSet',
                'cloudformation:ExecuteChangeSet',
              ]),
            }),
          ]),
        },
      });
    });

    it('grants Lambda update permissions scoped to learnverse functions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'LambdaUpdate',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'lambda:UpdateFunctionCode',
                'lambda:UpdateFunctionConfiguration',
              ]),
              Resource: 'arn:aws:lambda:ap-south-1:123456789012:function:learnverse-*',
            }),
          ]),
        },
      });
    });

    it('grants S3 sync permissions for asset deployment', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'S3Sync',
              Effect: 'Allow',
              Action: Match.arrayWith([
                's3:PutObject',
                's3:GetObject',
                's3:DeleteObject',
                's3:ListBucket',
              ]),
            }),
          ]),
        },
      });
    });

    it('grants CloudFront invalidation permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'CloudFrontInvalidation',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'cloudfront:CreateInvalidation',
              ]),
            }),
          ]),
        },
      });
    });

    it('grants IAM permissions scoped to learnverse and CDK roles', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'IAMForCDK',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'iam:PassRole',
                'iam:CreateRole',
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('Stack Output', () => {
    it('exports the deploy role ARN', () => {
      template.hasOutput('DeployRoleArn', {
        Export: {
          Name: 'LearnVerse-GitHubActionsDeployRoleArn',
        },
      });
    });
  });
});
