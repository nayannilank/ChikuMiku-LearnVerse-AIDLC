import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly userPool: cognito.IUserPool;
  readonly functions: Record<string, lambda.Function>;
}

export class ApiStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stageName, userPool, functions } = props;

    // Access log group for API Gateway
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/learnverse-${stageName}-api`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // REST API
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `learnverse-${stageName}-api`,
      deployOptions: {
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        stageName: stageName,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    // Gateway responses with CORS headers for 4XX
    this.api.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'*'",
      },
    });

    // Gateway responses with CORS headers for 5XX
    this.api.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'*'",
      },
    });

    // Cognito User Pools Authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: `learnverse-${stageName}-cognito-authorizer`,
    });

    // --- Wire API Gateway routes to Lambda integrations ---

    const authIntegration = new apigateway.LambdaIntegration(functions.auth);
    const contentIntegration = new apigateway.LambdaIntegration(functions.content);
    const learningIntegration = new apigateway.LambdaIntegration(functions.learning);
    const syncIntegration = new apigateway.LambdaIntegration(functions.sync);

    const publicMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
    };

    const protectedMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.authorizer,
    };

    // Define all resource paths under /api/v1 prefix
    const apiResource = this.api.root.addResource('api');
    const v1 = apiResource.addResource('v1');

    // --- Auth routes ---
    const auth = v1.addResource('auth');
    auth.addResource('login').addMethod('POST', authIntegration, publicMethodOptions);
    const register = auth.addResource('register');
    register.addResource('parent').addMethod('POST', authIntegration, publicMethodOptions);
    register.addResource('student').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('forgot-password').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('validate').addMethod('GET', authIntegration, protectedMethodOptions);
    auth.addResource('refresh').addMethod('POST', authIntegration, publicMethodOptions);

    // --- Content routes ---
    // /subjects
    const subjects = v1.addResource('subjects');
    subjects.addMethod('GET', contentIntegration, protectedMethodOptions);
    const subjectId = subjects.addResource('{subjectId}');
    subjectId.addResource('enroll').addMethod('POST', contentIntegration, protectedMethodOptions);
    const subjectTextbooks = subjectId.addResource('textbooks');
    subjectTextbooks.addMethod('GET', contentIntegration, protectedMethodOptions);
    subjectTextbooks.addMethod('POST', contentIntegration, protectedMethodOptions);
    subjectId.addResource('chapters').addMethod('GET', contentIntegration, protectedMethodOptions);

    // /textbooks
    const textbooks = v1.addResource('textbooks');
    const textbookId = textbooks.addResource('{textbookId}');
    const textbookChapters = textbookId.addResource('chapters');
    textbookChapters.addMethod('GET', contentIntegration, protectedMethodOptions);
    textbookChapters.addMethod('POST', contentIntegration, protectedMethodOptions);

    // /chapters
    const chapters = v1.addResource('chapters');
    chapters.addMethod('POST', contentIntegration, protectedMethodOptions);
    const chapterId = chapters.addResource('{chapterId}');
    chapterId.addMethod('GET', contentIntegration, protectedMethodOptions);
    chapterId.addResource('pages').addMethod('POST', contentIntegration, protectedMethodOptions);

    // /progress
    const progress = v1.addResource('progress');
    progress.addMethod('GET', contentIntegration, protectedMethodOptions);
    progress.addMethod('POST', contentIntegration, protectedMethodOptions);

    // /revision
    const revision = v1.addResource('revision');
    const sessions = revision.addResource('sessions');
    sessions.addMethod('POST', contentIntegration, protectedMethodOptions);
    const sessionId = sessions.addResource('{sessionId}');
    sessionId.addResource('answers').addMethod('POST', contentIntegration, protectedMethodOptions);
    sessionId.addResource('summary').addMethod('GET', contentIntegration, protectedMethodOptions);

    // --- Learning routes ---
    const learning = v1.addResource('learning');
    learning.addResource('start').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('select-subject').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('select-chapter').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('new-chapter').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('end-chapter').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('end').addMethod('POST', learningIntegration, protectedMethodOptions);
    learning.addResource('session').addMethod('GET', learningIntegration, protectedMethodOptions);

    // --- Sync routes ---
    const sync = v1.addResource('sync');
    sync.addResource('push').addMethod('POST', syncIntegration, protectedMethodOptions);
    sync.addResource('pull').addMethod('GET', syncIntegration, protectedMethodOptions);
  }
}
