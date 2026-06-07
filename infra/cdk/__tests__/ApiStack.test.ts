import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';

describe('ApiStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaUserPool = new cognito.UserPool(qaParent, 'UserPool');
    const qaApiStack = new ApiStack(qaParent, 'ApiStack', {
      stageName: 'qa',
      userPool: qaUserPool,
    });
    // Attach a mock integration to trigger authorizer resolution
    qaApiStack.api.root.addMethod('GET', new apigateway.MockIntegration(), {
      authorizer: qaApiStack.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    qaTemplate = Template.fromStack(qaApiStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodUserPool = new cognito.UserPool(prodParent, 'UserPool');
    const prodApiStack = new ApiStack(prodParent, 'ApiStack', {
      stageName: 'prod',
      userPool: prodUserPool,
    });
    // Attach a mock integration to trigger authorizer resolution
    prodApiStack.api.root.addMethod('GET', new apigateway.MockIntegration(), {
      authorizer: prodApiStack.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
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
