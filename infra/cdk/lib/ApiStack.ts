import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly userPool: cognito.IUserPool;
}

export class ApiStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stageName, userPool } = props;

    // Access log group for API Gateway
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/chikumiku-${stageName}-api`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // REST API
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `chikumiku-${stageName}-api`,
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
      authorizerName: `chikumiku-${stageName}-cognito-authorizer`,
    });

    // Define all resource paths under /api/v1 prefix
    const apiResource = this.api.root.addResource('api');
    const v1 = apiResource.addResource('v1');

    // /auth routes
    const auth = v1.addResource('auth');
    auth.addResource('login');
    const register = auth.addResource('register');
    register.addResource('parent');
    register.addResource('student');
    auth.addResource('forgot-password');
    auth.addResource('validate');
    auth.addResource('refresh');

    // /subjects routes
    const subjects = v1.addResource('subjects');
    const subjectId = subjects.addResource('{subjectId}');
    subjectId.addResource('enroll');
    subjectId.addResource('textbooks');
    subjectId.addResource('chapters');

    // /textbooks routes
    const textbooks = v1.addResource('textbooks');
    const textbookId = textbooks.addResource('{textbookId}');
    textbookId.addResource('chapters');

    // /chapters routes
    const chapters = v1.addResource('chapters');
    const chapterId = chapters.addResource('{chapterId}');
    chapterId.addResource('pages');

    // /progress routes
    v1.addResource('progress');

    // /revision routes
    const revision = v1.addResource('revision');
    const sessions = revision.addResource('sessions');
    const sessionId = sessions.addResource('{sessionId}');
    sessionId.addResource('answers');
    sessionId.addResource('summary');

    // /learning routes
    const learning = v1.addResource('learning');
    learning.addResource('start');
    learning.addResource('select-subject');
    learning.addResource('select-chapter');
    learning.addResource('new-chapter');
    learning.addResource('end-chapter');
    learning.addResource('end');
    learning.addResource('session');

    // /sync routes
    const sync = v1.addResource('sync');
    sync.addResource('push');
    sync.addResource('pull');
  }
}
