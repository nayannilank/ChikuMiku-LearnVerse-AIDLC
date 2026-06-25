import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';
import { ComputeStack } from '../lib/ComputeStack';

describe('ApiStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // Helper to create dependencies for a given stack
    function createDependencies(parent: cdk.Stack, prefix: string) {
      const userPool = new cognito.UserPool(parent, 'UserPool');
      const userPoolClient = new cognito.UserPoolClient(parent, 'UserPoolClient', { userPool });

      const vpc = new ec2.Vpc(parent, 'Vpc', { maxAzs: 2 });
      const lambdaSecurityGroup = new ec2.SecurityGroup(parent, 'LambdaSG', {
        vpc,
        securityGroupName: `learnverse-${prefix}-lambda-sg`,
      });

      const dbCluster = new rds.DatabaseCluster(parent, 'PostgresCluster', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_16_4,
        }),
        writer: rds.ClusterInstance.serverlessV2('writer'),
        vpc,
        defaultDatabaseName: 'learnverse',
      });

      const contentBucket = new s3.Bucket(parent, 'ContentBucket', {
        bucketName: `learnverse-${prefix}-content-bucket`,
      });

      return { userPool, userPoolClient, vpc, lambdaSecurityGroup, dbCluster, contentBucket };
    }

    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaDeps = createDependencies(qaParent, 'qa');
    const qaComputeStack = new ComputeStack(qaParent, 'ComputeStack', {
      stageName: 'qa',
      vpc: qaDeps.vpc,
      lambdaSecurityGroup: qaDeps.lambdaSecurityGroup,
      dbCluster: qaDeps.dbCluster,
      contentBucket: qaDeps.contentBucket,
      userPool: qaDeps.userPool,
      userPoolClientId: qaDeps.userPoolClient.userPoolClientId,
    });
    const qaApiStack = new ApiStack(qaParent, 'ApiStack', {
      stageName: 'qa',
      userPool: qaDeps.userPool,
      functions: qaComputeStack.functions,
    });
    qaTemplate = Template.fromStack(qaApiStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodDeps = createDependencies(prodParent, 'prod');
    const prodComputeStack = new ComputeStack(prodParent, 'ComputeStack', {
      stageName: 'prod',
      vpc: prodDeps.vpc,
      lambdaSecurityGroup: prodDeps.lambdaSecurityGroup,
      dbCluster: prodDeps.dbCluster,
      contentBucket: prodDeps.contentBucket,
      userPool: prodDeps.userPool,
      userPoolClientId: prodDeps.userPoolClient.userPoolClientId,
    });
    const prodApiStack = new ApiStack(prodParent, 'ApiStack', {
      stageName: 'prod',
      userPool: prodDeps.userPool,
      functions: prodComputeStack.functions,
    });
    prodTemplate = Template.fromStack(prodApiStack);
  });

  describe('REST API X-Ray Tracing (Requirement 2.8)', () => {
    it('has X-Ray tracing enabled in deploy options', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Stage', {
        TracingEnabled: true,
      });
    });
  });

  describe('Cognito Authorizer (Requirement 2.8)', () => {
    it('creates a Cognito User Pools authorizer with correct identity source', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
        IdentitySource: 'method.request.header.Authorization',
      });
    });
  });

  describe('Resource Paths (Requirement 3.8)', () => {
    it('defines /auth resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'auth',
      });
    });

    it('defines /subjects resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'subjects',
      });
    });

    it('defines /books resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'books',
      });
    });

    it('defines /chapters resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'chapters',
      });
    });

    it('defines /exercises resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'exercises',
      });
    });

    it('defines /progress resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'progress',
      });
    });

    it('defines /quiz resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'quiz',
      });
    });

    it('defines /pronunciation resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'pronunciation',
      });
    });

    it('defines /parent resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'parent',
      });
    });
  });

  describe('CORS Gateway Responses (Requirement 3.8)', () => {
    it('configures 4XX gateway response with CORS headers', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
        ResponseType: 'DEFAULT_4XX',
        ResponseParameters: Match.objectLike({
          'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
          'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
          'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
        }),
      });
    });

    it('configures 5XX gateway response with CORS headers', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
        ResponseType: 'DEFAULT_5XX',
        ResponseParameters: Match.objectLike({
          'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
          'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
          'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
        }),
      });
    });
  });
});
