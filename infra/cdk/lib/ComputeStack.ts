import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { Construct } from 'constructs';
import { SecureLambda } from './constructs/SecureLambda';

export interface ComputeStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly vpc: ec2.Vpc;
  readonly lambdaSecurityGroup: ec2.SecurityGroup;
  readonly dbCluster: rds.DatabaseCluster;
  readonly contentBucket: s3.Bucket;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClientId: string;
}

export class ComputeStack extends cdk.NestedStack {
  public readonly functions: Record<string, lambda.Function>;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const {
      stageName,
      vpc,
      lambdaSecurityGroup,
      dbCluster,
      contentBucket,
      userPool,
      userPoolClientId,
    } = props;

    // Common environment variables for all Lambda functions
    const commonEnv: Record<string, string> = {
      STAGE_NAME: stageName,
      DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
      DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
      DB_CLUSTER_PORT: '5432',
      DB_NAME: 'learnverse',
      CONTENT_BUCKET: contentBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClientId,
    };

    // Common VPC configuration for database-connected functions
    const vpcSubnets: ec2.SubnetSelection = {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    // --- 8 Service Domain Lambda Functions ---

    // 1. Auth Service
    const authLambda = new SecureLambda(this, 'AuthLambda', {
      serviceName: 'auth',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/auth'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 256,
      timeout: 30,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 2. Content Store Service
    const contentStoreLambda = new SecureLambda(this, 'ContentStoreLambda', {
      serviceName: 'content-store',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/content-store'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 256,
      timeout: 30,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 3. Content Ingestion Service
    const contentIngestionLambda = new SecureLambda(this, 'ContentIngestionLambda', {
      serviceName: 'content-ingestion',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/content-ingestion'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 512,
      timeout: 60,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 4. Comprehension Service
    const comprehensionLambda = new SecureLambda(this, 'ComprehensionLambda', {
      serviceName: 'comprehension',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/comprehension'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 512,
      timeout: 60,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 5. Progress/Sync Service
    const syncLambda = new SecureLambda(this, 'SyncLambda', {
      serviceName: 'sync',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/sync'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 256,
      timeout: 30,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 6. Pronunciation Service
    const pronunciationLambda = new SecureLambda(this, 'PronunciationLambda', {
      serviceName: 'pronunciation',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/pronunciation'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 512,
      timeout: 30,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 7. Grammar Service
    const grammarLambda = new SecureLambda(this, 'GrammarLambda', {
      serviceName: 'grammar',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/grammar'),
      handler: 'dist/index.handler',
      environment: commonEnv,
      memorySize: 256,
      timeout: 30,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // 8. AI Gateway Service
    const aiGatewayLambda = new SecureLambda(this, 'AiGatewayLambda', {
      serviceName: 'ai-gateway',
      stageName,
      codePath: path.join(__dirname, '../../../packages/services/ai-gateway'),
      handler: 'dist/index.handler',
      environment: {
        ...commonEnv,
        // AI service timeouts
        OCR_TIMEOUT_MS: '30000',
        TEXT_GEN_TIMEOUT_MS: '15000',
        EMBEDDINGS_TIMEOUT_MS: '10000',
        TTS_TIMEOUT_MS: '60000',
      },
      memorySize: 512,
      timeout: 90,
      vpc,
      vpcSubnets,
      securityGroups: [lambdaSecurityGroup],
    });

    // Export functions map
    this.functions = {
      auth: authLambda.function,
      'content-store': contentStoreLambda.function,
      'content-ingestion': contentIngestionLambda.function,
      comprehension: comprehensionLambda.function,
      sync: syncLambda.function,
      pronunciation: pronunciationLambda.function,
      grammar: grammarLambda.function,
      'ai-gateway': aiGatewayLambda.function,
    };

    // --- IAM Permissions ---

    // All functions need access to DB credentials secret
    for (const fn of Object.values(this.functions)) {
      if (dbCluster.secret) {
        dbCluster.secret.grantRead(fn);
      }
    }

    // Auth Lambda: Cognito admin actions
    authLambda.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminUserGlobalSignOut',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Content Ingestion and Pronunciation: S3 read/write for images and audio
    contentBucket.grantReadWrite(contentIngestionLambda.function);
    contentBucket.grantReadWrite(pronunciationLambda.function);
    contentBucket.grantRead(comprehensionLambda.function);
    contentBucket.grantReadWrite(aiGatewayLambda.function);
  }
}
