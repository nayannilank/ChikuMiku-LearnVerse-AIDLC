import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
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
  readonly api: apigateway.RestApi;
  readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClientId: string;
}

export class LambdaStack extends cdk.NestedStack {
  public readonly functions: Record<string, lambda.Function>;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { stageName, tables, contentBucket, api, authorizer, userPool, userPoolClientId } = props;
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

    // --- 7.1: Create 4 SecureLambda constructs ---

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

    // --- 7.3: Configure least-privilege IAM policies ---

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

    // --- 7.2: Wire API Gateway routes to Lambda integrations ---

    const authIntegration = new apigateway.LambdaIntegration(authLambda.function);
    const contentIntegration = new apigateway.LambdaIntegration(contentLambda.function);
    const learningIntegration = new apigateway.LambdaIntegration(learningLambda.function);
    const syncIntegration = new apigateway.LambdaIntegration(syncLambda.function);

    const publicMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
    };

    const protectedMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    };

    // Navigate the API resource tree
    const v1 = api.root.getResource('api')!.getResource('v1')!;

    // --- Auth routes ---
    const authResource = v1.getResource('auth')!;
    authResource.getResource('login')!.addMethod('POST', authIntegration, publicMethodOptions);
    authResource.getResource('register')!.getResource('parent')!.addMethod('POST', authIntegration, publicMethodOptions);
    authResource.getResource('register')!.getResource('student')!.addMethod('POST', authIntegration, publicMethodOptions);
    authResource.getResource('forgot-password')!.addMethod('POST', authIntegration, publicMethodOptions);
    authResource.getResource('validate')!.addMethod('GET', authIntegration, protectedMethodOptions);
    authResource.getResource('refresh')!.addMethod('POST', authIntegration, publicMethodOptions);

    // --- Content routes ---
    // /subjects
    const subjectsResource = v1.getResource('subjects')!;
    subjectsResource.addMethod('GET', contentIntegration, protectedMethodOptions);

    const subjectIdResource = subjectsResource.getResource('{subjectId}')!;
    subjectIdResource.getResource('enroll')!.addMethod('POST', contentIntegration, protectedMethodOptions);
    subjectIdResource.getResource('textbooks')!.addMethod('GET', contentIntegration, protectedMethodOptions);
    subjectIdResource.getResource('textbooks')!.addMethod('POST', contentIntegration, protectedMethodOptions);
    subjectIdResource.getResource('chapters')!.addMethod('GET', contentIntegration, protectedMethodOptions);

    // /textbooks
    const textbooksResource = v1.getResource('textbooks')!;
    const textbookIdResource = textbooksResource.getResource('{textbookId}')!;
    textbookIdResource.getResource('chapters')!.addMethod('GET', contentIntegration, protectedMethodOptions);
    textbookIdResource.getResource('chapters')!.addMethod('POST', contentIntegration, protectedMethodOptions);

    // /chapters
    const chaptersResource = v1.getResource('chapters')!;
    chaptersResource.addMethod('POST', contentIntegration, protectedMethodOptions);
    const chapterIdResource = chaptersResource.getResource('{chapterId}')!;
    chapterIdResource.addMethod('GET', contentIntegration, protectedMethodOptions);
    chapterIdResource.getResource('pages')!.addMethod('POST', contentIntegration, protectedMethodOptions);

    // /progress
    const progressResource = v1.getResource('progress')!;
    progressResource.addMethod('GET', contentIntegration, protectedMethodOptions);
    progressResource.addMethod('POST', contentIntegration, protectedMethodOptions);

    // /revision
    const revisionResource = v1.getResource('revision')!;
    const sessionsResource = revisionResource.getResource('sessions')!;
    sessionsResource.addMethod('POST', contentIntegration, protectedMethodOptions);
    const sessionIdResource = sessionsResource.getResource('{sessionId}')!;
    sessionIdResource.getResource('answers')!.addMethod('POST', contentIntegration, protectedMethodOptions);
    sessionIdResource.getResource('summary')!.addMethod('GET', contentIntegration, protectedMethodOptions);

    // --- Learning routes ---
    const learningResource = v1.getResource('learning')!;
    learningResource.getResource('start')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('select-subject')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('select-chapter')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('new-chapter')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('end-chapter')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('end')!.addMethod('POST', learningIntegration, protectedMethodOptions);
    learningResource.getResource('session')!.addMethod('GET', learningIntegration, protectedMethodOptions);

    // --- Sync routes ---
    const syncResource = v1.getResource('sync')!;
    syncResource.getResource('push')!.addMethod('POST', syncIntegration, protectedMethodOptions);
    syncResource.getResource('pull')!.addMethod('GET', syncIntegration, protectedMethodOptions);
  }
}
