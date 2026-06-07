import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { Construct } from 'constructs';
import { SecureLambda } from './constructs/SecureLambda';

export interface LambdaStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly tables: {
    readonly learnersTable: dynamodb.Table;
    readonly accountsTable: dynamodb.Table;
    readonly contentTable: dynamodb.Table;
  };
  readonly contentBucket: s3.Bucket;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClientId: string;
}

export class LambdaStack extends cdk.NestedStack {
  public readonly functions: Record<string, lambda.Function>;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { stageName, tables, contentBucket, userPool, userPoolClientId } = props;
    const codePath = path.join(__dirname, '../../../packages/services/api');

    // Common environment variables
    const commonEnv: Record<string, string> = {
      LEARNERS_TABLE: tables.learnersTable.tableName,
      ACCOUNTS_TABLE: tables.accountsTable.tableName,
      CONTENT_TABLE: tables.contentTable.tableName,
      CONTENT_BUCKET: contentBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClientId,
      STAGE_NAME: stageName,
    };

    // --- Create 4 SecureLambda constructs ---

    const authLambda = new SecureLambda(this, 'AuthLambda', {
      serviceName: 'auth',
      stageName,
      codePath,
      handler: 'dist/handlers/auth/index.handler',
      environment: commonEnv,
    });

    const contentLambda = new SecureLambda(this, 'ContentLambda', {
      serviceName: 'content',
      stageName,
      codePath,
      handler: 'dist/handlers/content/index.handler',
      environment: commonEnv,
    });

    const learningLambda = new SecureLambda(this, 'LearningLambda', {
      serviceName: 'learning',
      stageName,
      codePath,
      handler: 'dist/handlers/learning/index.handler',
      environment: commonEnv,
    });

    const syncLambda = new SecureLambda(this, 'SyncLambda', {
      serviceName: 'sync',
      stageName,
      codePath,
      handler: 'dist/handlers/sync/index.handler',
      environment: commonEnv,
    });

    // Export functions map
    this.functions = {
      auth: authLambda.function,
      content: contentLambda.function,
      learning: learningLambda.function,
      sync: syncLambda.function,
    };

    // --- Configure least-privilege IAM policies ---

    // Auth Lambda: accounts + learners tables R/W, Cognito admin actions
    tables.accountsTable.grantReadWriteData(authLambda.function);
    tables.learnersTable.grantReadWriteData(authLambda.function);
    authLambda.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminGetUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Content Lambda: content + learners tables R/W, contentBucket R/W
    tables.contentTable.grantReadWriteData(contentLambda.function);
    tables.learnersTable.grantReadWriteData(contentLambda.function);
    contentBucket.grantReadWrite(contentLambda.function);

    // Learning Lambda: learners table R/W, content table R
    tables.learnersTable.grantReadWriteData(learningLambda.function);
    tables.contentTable.grantReadData(learningLambda.function);

    // Sync Lambda: learners + content tables R/W
    tables.learnersTable.grantReadWriteData(syncLambda.function);
    tables.contentTable.grantReadWriteData(syncLambda.function);
  }
}
