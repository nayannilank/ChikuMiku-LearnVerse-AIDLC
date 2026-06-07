import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/ApiStack';
import { LambdaStack } from '../lib/LambdaStack';

describe('LambdaStack', () => {
  let lambdaTemplate: Template;
  let apiTemplate: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const parentStack = new cdk.Stack(app, 'ParentStack');

    // Create dependencies
    const userPool = new cognito.UserPool(parentStack, 'UserPool');
    const userPoolClient = new cognito.UserPoolClient(parentStack, 'UserPoolClient', {
      userPool,
    });

    const learnersTable = new dynamodb.Table(parentStack, 'LearnersTable', {
      tableName: 'learnverse-qa-learners',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const accountsTable = new dynamodb.Table(parentStack, 'AccountsTable', {
      tableName: 'learnverse-qa-accounts',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentTable = new dynamodb.Table(parentStack, 'ContentTable', {
      tableName: 'learnverse-qa-content',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    const contentBucket = new s3.Bucket(parentStack, 'ContentBucket', {
      bucketName: 'learnverse-qa-content-bucket',
    });

    // Create LambdaStack first (functions only)
    const lambdaStack = new LambdaStack(parentStack, 'LambdaStack', {
      stageName: 'qa',
      tables: { learnersTable, accountsTable, contentTable },
      contentBucket,
      userPool,
      userPoolClientId: userPoolClient.userPoolClientId,
    });

    // Create ApiStack with the functions from LambdaStack
    const apiStack = new ApiStack(parentStack, 'ApiStack', {
      stageName: 'qa',
      userPool,
      functions: lambdaStack.functions,
    });

    lambdaTemplate = Template.fromStack(lambdaStack);
    // API Gateway methods are synthesized in the ApiStack since resources belong to it
    apiTemplate = Template.fromStack(apiStack);
  });

  describe('Lambda Functions (Requirement 3.1, 3.2)', () => {
    it('creates exactly 4 Lambda functions', () => {
      lambdaTemplate.resourceCountIs('AWS::Lambda::Function', 4);
    });

    it('all Lambda functions use Node.js 22 runtime', () => {
      const functions = lambdaTemplate.findResources('AWS::Lambda::Function');
      const functionIds = Object.keys(functions);
      expect(functionIds.length).toBe(4);

      for (const id of functionIds) {
        expect(functions[id].Properties.Runtime).toBe('nodejs22.x');
      }
    });

    it('creates auth Lambda with correct name', () => {
      lambdaTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'learnverse-qa-auth',
        Runtime: 'nodejs22.x',
      });
    });

    it('creates content Lambda with correct name', () => {
      lambdaTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'learnverse-qa-content',
        Runtime: 'nodejs22.x',
      });
    });

    it('creates learning Lambda with correct name', () => {
      lambdaTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'learnverse-qa-learning',
        Runtime: 'nodejs22.x',
      });
    });

    it('creates sync Lambda with correct name', () => {
      lambdaTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'learnverse-qa-sync',
        Runtime: 'nodejs22.x',
      });
    });

    it('all Lambda functions have X-Ray tracing enabled', () => {
      const functions = lambdaTemplate.findResources('AWS::Lambda::Function');
      for (const id of Object.keys(functions)) {
        expect(functions[id].Properties.TracingConfig).toEqual({ Mode: 'Active' });
      }
    });

    it('all Lambda functions have 256 MB memory', () => {
      const functions = lambdaTemplate.findResources('AWS::Lambda::Function');
      for (const id of Object.keys(functions)) {
        expect(functions[id].Properties.MemorySize).toBe(256);
      }
    });

    it('all Lambda functions have 30s timeout', () => {
      const functions = lambdaTemplate.findResources('AWS::Lambda::Function');
      for (const id of Object.keys(functions)) {
        expect(functions[id].Properties.Timeout).toBe(30);
      }
    });
  });

  describe('IAM Policies - Least Privilege (Requirement 3.3)', () => {
    /**
     * Helper to get all IAM policy statements for a given Lambda role pattern.
     */
    function getStatementsForRole(rolePattern: RegExp): Array<{ Action: string[]; Effect: string; Resource: unknown }> {
      const policies = lambdaTemplate.findResources('AWS::IAM::Policy');
      const statements: Array<{ Action: string[]; Effect: string; Resource: unknown }> = [];

      for (const id of Object.keys(policies)) {
        const roles = policies[id].Properties.Roles;
        const matchesRole = roles?.some((r: Record<string, string>) =>
          r.Ref && rolePattern.test(r.Ref)
        );
        if (matchesRole) {
          const stmts = policies[id].Properties.PolicyDocument.Statement;
          statements.push(...stmts);
        }
      }
      return statements;
    }

    function hasAction(statements: Array<{ Action: string[] | string }>, actionPrefix: string): boolean {
      return statements.some((stmt) => {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        return actions.some((a: string) => a.startsWith(actionPrefix));
      });
    }

    it('auth Lambda has DynamoDB access', () => {
      const stmts = getStatementsForRole(/AuthLambda/);
      expect(hasAction(stmts, 'dynamodb:')).toBe(true);
    });

    it('auth Lambda has Cognito admin actions', () => {
      const stmts = getStatementsForRole(/AuthLambda/);
      expect(hasAction(stmts, 'cognito-idp:Admin')).toBe(true);
    });

    it('auth Lambda does NOT have S3 access', () => {
      const stmts = getStatementsForRole(/AuthLambda/);
      expect(hasAction(stmts, 's3:')).toBe(false);
    });

    it('content Lambda has DynamoDB access', () => {
      const stmts = getStatementsForRole(/ContentLambda/);
      expect(hasAction(stmts, 'dynamodb:')).toBe(true);
    });

    it('content Lambda has S3 access', () => {
      const stmts = getStatementsForRole(/ContentLambda/);
      expect(hasAction(stmts, 's3:')).toBe(true);
    });

    it('content Lambda does NOT have Cognito permissions', () => {
      const stmts = getStatementsForRole(/ContentLambda/);
      expect(hasAction(stmts, 'cognito-idp:')).toBe(false);
    });

    it('learning Lambda has DynamoDB access', () => {
      const stmts = getStatementsForRole(/LearningLambda/);
      expect(hasAction(stmts, 'dynamodb:')).toBe(true);
    });

    it('learning Lambda does NOT have S3 access', () => {
      const stmts = getStatementsForRole(/LearningLambda/);
      expect(hasAction(stmts, 's3:')).toBe(false);
    });

    it('learning Lambda does NOT have Cognito permissions', () => {
      const stmts = getStatementsForRole(/LearningLambda/);
      expect(hasAction(stmts, 'cognito-idp:')).toBe(false);
    });

    it('sync Lambda has DynamoDB access', () => {
      const stmts = getStatementsForRole(/SyncLambda/);
      expect(hasAction(stmts, 'dynamodb:')).toBe(true);
    });

    it('sync Lambda does NOT have S3 access', () => {
      const stmts = getStatementsForRole(/SyncLambda/);
      expect(hasAction(stmts, 's3:')).toBe(false);
    });

    it('sync Lambda does NOT have Cognito permissions', () => {
      const stmts = getStatementsForRole(/SyncLambda/);
      expect(hasAction(stmts, 'cognito-idp:')).toBe(false);
    });
  });

  describe('API Gateway Methods (Requirement 3.8, 3.9)', () => {
    it('creates API Gateway methods for all routes', () => {
      // Methods are synthesized in the ApiStack since resources belong there
      const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
      const methodCount = Object.keys(methods).length;
      // Auth: 6, Content: 15, Learning: 7, Sync: 2 = 30 routes (excluding CORS OPTIONS methods)
      expect(methodCount).toBeGreaterThanOrEqual(30);
    });

    it('public auth routes have AuthorizationType NONE', () => {
      apiTemplate.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        AuthorizationType: 'NONE',
      });
    });

    it('protected routes have AuthorizationType COGNITO_USER_POOLS', () => {
      apiTemplate.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        AuthorizationType: 'COGNITO_USER_POOLS',
      });
    });

    it('non-OPTIONS methods use Lambda integrations (AWS_PROXY)', () => {
      const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
      for (const id of Object.keys(methods)) {
        const httpMethod = methods[id].Properties.HttpMethod;
        // Skip CORS preflight OPTIONS methods (which use MOCK) and the root mock integration
        if (httpMethod === 'OPTIONS') continue;
        const integration = methods[id].Properties.Integration;
        if (integration && integration.Type !== 'MOCK') {
          expect(integration.Type).toBe('AWS_PROXY');
        }
      }
    });
  });

  describe('Protected Endpoints (Requirement 2.8)', () => {
    it('protected endpoints have COGNITO_USER_POOLS authorization', () => {
      const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
      let cognitoCount = 0;
      let noneCount = 0;

      for (const id of Object.keys(methods)) {
        const httpMethod = methods[id].Properties.HttpMethod;
        // Skip CORS preflight OPTIONS methods
        if (httpMethod === 'OPTIONS') continue;
        const authType = methods[id].Properties.AuthorizationType;
        if (authType === 'COGNITO_USER_POOLS') {
          cognitoCount++;
        } else if (authType === 'NONE') {
          noneCount++;
        }
      }

      // Auth public routes: login, register/parent, register/student, forgot-password, refresh = 5 NONE
      expect(noneCount).toBe(5);
      // Protected routes: validate(1) + content(15) + learning(7) + sync(2) = 25
      expect(cognitoCount).toBe(25);
    });

    it('protected endpoints have authorizer ID attached', () => {
      const methods = apiTemplate.findResources('AWS::ApiGateway::Method');
      for (const id of Object.keys(methods)) {
        const authType = methods[id].Properties.AuthorizationType;
        if (authType === 'COGNITO_USER_POOLS') {
          expect(methods[id].Properties.AuthorizerId).toBeDefined();
        }
      }
    });
  });
});
