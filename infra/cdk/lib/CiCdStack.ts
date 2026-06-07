import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CiCdStackProps extends cdk.StackProps {
  /**
   * The GitHub repository in the format 'owner/repo'.
   * Used to scope the OIDC trust policy.
   */
  readonly githubRepo: string;
}

/**
 * Stack defining the GitHub OIDC provider and IAM role for keyless CI/CD.
 * Eliminates the need for static AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY secrets.
 *
 * Requirements: 4.1, 4.2
 */
export class CiCdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: CiCdStackProps) {
    super(scope, id, props);

    // GitHub Actions OIDC provider
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // IAM role trusted by the GitHub Actions OIDC provider for this repository
    this.deployRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'learnverse-github-actions-deploy',
      description: 'IAM role for GitHub Actions CI/CD via OIDC (LearnVerse LearnVerse)',
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // --- Permissions for CDK deployment ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CDKDeploy',
        effect: iam.Effect.ALLOW,
        actions: [
          // CloudFormation (CDK deploy)
          'cloudformation:CreateStack',
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:GetTemplate',
          'cloudformation:GetTemplateSummary',
          'cloudformation:ListStackResources',
          'cloudformation:CreateChangeSet',
          'cloudformation:DescribeChangeSet',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DeleteChangeSet',
          'cloudformation:ListChangeSets',
          // STS for CDK bootstrap
          'sts:AssumeRole',
        ],
        resources: ['*'],
      }),
    );

    // --- Permissions for Lambda updates ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'LambdaUpdate',
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:UpdateFunctionCode',
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:ListFunctions',
          'lambda:PublishVersion',
          'lambda:CreateAlias',
          'lambda:UpdateAlias',
        ],
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:learnverse-*`,
        ],
      }),
    );

    // --- Permissions for S3 asset sync ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3Sync',
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject',
          's3:ListBucket',
          's3:GetBucketLocation',
        ],
        resources: [
          `arn:aws:s3:::learnverse-*`,
          `arn:aws:s3:::learnverse-*/*`,
          // CDK bootstrap bucket
          `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}`,
          `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}/*`,
        ],
      }),
    );

    // --- Permissions for CloudFront cache invalidation ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFrontInvalidation',
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudfront:CreateInvalidation',
          'cloudfront:GetInvalidation',
          'cloudfront:ListInvalidations',
        ],
        resources: ['*'],
      }),
    );

    // --- Permissions for IAM (CDK needs to manage roles/policies) ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'IAMForCDK',
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:PassRole',
          'iam:GetRole',
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:TagRole',
          'iam:UntagRole',
        ],
        resources: [
          `arn:aws:iam::${this.account}:role/learnverse-*`,
          `arn:aws:iam::${this.account}:role/cdk-*`,
        ],
      }),
    );

    // --- SSM Parameter Store (CDK bootstrap lookups) ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SSMForCDK',
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
        ],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/*`,
        ],
      }),
    );

    // --- ECR (CDK may use container images) ---
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRForCDK',
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        resources: ['*'],
      }),
    );

    // Output the role ARN for use in GitHub Actions workflow
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: this.deployRole.roleArn,
      description: 'ARN of the GitHub Actions deploy role for use in CI/CD workflow',
      exportName: 'LearnVerse-GitHubActionsDeployRoleArn',
    });
  }
}
