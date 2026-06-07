import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';
import { LambdaStack } from '../lib/LambdaStack';

describe('ApiStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // Helper to create dependencies for a given stack
    function createDependencies(parent: cdk.Stack, prefix: string) {
      const userPool = new cognito.UserPool(parent, 'UserPool');
      const userPoolClient = new cognito.UserPoolClient(parent, 'UserPoolClient', { userPool });

      const learnersTable = new dynamodb.Table(parent, 'LearnersTable', {
        tableName: `learnverse-${prefix}-learners`,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      });
      const accountsTable = new dynamodb.Table(parent, 'AccountsTable', {
        tableName: `learnverse-${prefix}-accounts`,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      });
      const contentTable = new dynamodb.Table(parent, 'ContentTable', {
        tableName: `learnverse-${prefix}-content`,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      });
      const contentBucket = new s3.Bucket(parent, 'ContentBucket', {
        bucketName: `learnverse-${prefix}-content-bucket`,
      });

      return { userPool, userPoolClient, learnersTable, accountsTable, contentTable, contentBucket };
    }

    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaDeps = createDependencies(qaParent, 'qa');
    const qaLambdaStack = new LambdaStack(qaParent, 'LambdaStack', {
      stageName: 'qa',
      tables: { learnersTable: qaDeps.learnersTable, accountsTable: qaDeps.accountsTable, contentTable: qaDeps.contentTable },
      contentBucket: qaDeps.contentBucket,
      userPool: qaDeps.userPool,
      userPoolClientId: qaDeps.userPoolClient.userPoolClientId,
    });
    const qaApiStack = new ApiStack(qaParent, 'ApiStack', {
      stageName: 'qa',
      userPool: qaDeps.userPool,
      functions: qaLambdaStack.functions,
    });
    qaTemplate = Template.fromStack(qaApiStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodDeps = createDependencies(prodParent, 'prod');
    const prodLambdaStack = new LambdaStack(prodParent, 'LambdaStack', {
      stageName: 'prod',
      tables: { learnersTable: prodDeps.learnersTable, accountsTable: prodDeps.accountsTable, contentTable: prodDeps.contentTable },
      contentBucket: prodDeps.contentBucket,
      userPool: prodDeps.userPool,
      userPoolClientId: prodDeps.userPoolClient.userPoolClientId,
    });
    const prodApiStack = new ApiStack(prodParent, 'ApiStack', {
      stageName: 'prod',
      userPool: prodDeps.userPool,
      functions: prodLambdaStack.functions,
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

  describe('Resource Paths Under /api/v1 (Requirement 3.8)', () => {
    it('defines /api resource path', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'api',
      });
    });

    it('defines /v1 resource path under /api', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'v1',
      });
    });

    it('defines /auth route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'auth',
      });
    });

    it('defines /subjects route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'subjects',
      });
    });

    it('defines /textbooks route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'textbooks',
      });
    });

    it('defines /chapters route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'chapters',
      });
    });

    it('defines /progress route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'progress',
      });
    });

    it('defines /revision route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'revision',
      });
    });

    it('defines /learning route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'learning',
      });
    });

    it('defines /sync route under /api/v1', () => {
      qaTemplate.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'sync',
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
