import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/AuthStack';

describe('AuthStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaAuthStack = new AuthStack(qaParent, 'AuthStack', {
      stageName: 'qa',
    });
    qaTemplate = Template.fromStack(qaAuthStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodAuthStack = new AuthStack(prodParent, 'AuthStack', {
      stageName: 'prod',
    });
    prodTemplate = Template.fromStack(prodAuthStack);
  });

  describe('User Pool Password Policy (Requirement 2.2)', () => {
    it('enforces minimum 8 characters with uppercase, lowercase, and digit required', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireUppercase: true,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: false,
          },
        },
      });
    });
  });

  describe('Custom Attributes (Requirement 2.3)', () => {
    it('defines userType and parentId as String attributes', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({
            Name: 'userType',
            AttributeDataType: 'String',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'parentId',
            AttributeDataType: 'String',
            Mutable: true,
          }),
        ]),
      });
    });

    it('defines failedAttempts and lockUntil as Number attributes', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({
            Name: 'failedAttempts',
            AttributeDataType: 'Number',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'lockUntil',
            AttributeDataType: 'Number',
            Mutable: true,
          }),
        ]),
      });
    });
  });

  describe('User Pool Client Auth Flows (Requirement 2.4)', () => {
    it('enables ALLOW_USER_PASSWORD_AUTH and ALLOW_ADMIN_USER_PASSWORD_AUTH', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith([
          'ALLOW_USER_PASSWORD_AUTH',
          'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        ]),
      });
    });
  });

  describe('Removal Policy Per Environment (Requirement 2.5)', () => {
    it('sets DESTROY removal policy for User Pool in qa', () => {
      qaTemplate.hasResource('AWS::Cognito::UserPool', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    it('sets RETAIN removal policy for User Pool in prod', () => {
      prodTemplate.hasResource('AWS::Cognito::UserPool', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });

  describe('Sign-in Aliases (Requirement 2.1)', () => {
    it('configures email and phone as sign-in aliases', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: Match.arrayWith(['email', 'phone_number']),
      });
    });
  });

  describe('Token Validity (Requirement 2.5)', () => {
    it('sets access token validity to 60 minutes', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AccessTokenValidity: 60,
        TokenValidityUnits: Match.objectLike({
          AccessToken: 'minutes',
        }),
      });
    });

    it('sets ID token validity to 60 minutes', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        IdTokenValidity: 60,
        TokenValidityUnits: Match.objectLike({
          IdToken: 'minutes',
        }),
      });
    });

    it('sets refresh token validity to 30 days', () => {
      // CDK converts Duration.days(30) to 43200 minutes in synthesis
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        RefreshTokenValidity: 43200,
        TokenValidityUnits: Match.objectLike({
          RefreshToken: 'minutes',
        }),
      });
    });
  });

  describe('Auto Verify and Account Recovery', () => {
    it('enables auto-verification for email and phone', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: Match.arrayWith(['email', 'phone_number']),
      });
    });

    it('configures email-only account recovery', () => {
      qaTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            {
              Name: 'verified_email',
              Priority: 1,
            },
          ],
        },
      });
    });
  });
});
