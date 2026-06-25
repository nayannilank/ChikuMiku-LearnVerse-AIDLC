import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
}

export class AuthStack extends cdk.NestedStack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly parentGroup: cognito.CfnUserPoolGroup;
  public readonly studentGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { stageName } = props;
    const isProd = stageName === 'prod';

    // Cognito User Pool with password policy requiring special symbols (8-20 chars)
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `learnverse-${stageName}-user-pool`,
      signInAliases: {
        email: true,
        phone: true,
        username: true,
      },
      autoVerify: {
        email: true,
        phone: true,
      },
      selfSignUpEnabled: false, // registration handled by auth service
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        phoneNumber: { required: false, mutable: true },
      },
      customAttributes: {
        userType: new cognito.StringAttribute({ mutable: true }),
        parentId: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `learnverse-${stageName}-client`,
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      generateSecret: false,
    });

    // Parent user group
    this.parentGroup = new cognito.CfnUserPoolGroup(this, 'ParentGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'parent',
      description: 'Parent users who register students and monitor progress',
      precedence: 1,
    });

    // Student user group
    this.studentGroup = new cognito.CfnUserPoolGroup(this, 'StudentGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'student',
      description: 'Student users who access learning content',
      precedence: 2,
    });
  }
}
