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
        stageName,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'x-learner-id',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
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

    // --- Lambda Integrations ---
    const authIntegration = new apigateway.LambdaIntegration(functions.auth);
    const contentStoreIntegration = new apigateway.LambdaIntegration(functions['content-store']);
    const contentIngestionIntegration = new apigateway.LambdaIntegration(functions['content-ingestion']);
    const comprehensionIntegration = new apigateway.LambdaIntegration(functions.comprehension);
    const syncIntegration = new apigateway.LambdaIntegration(functions.sync);
    const pronunciationIntegration = new apigateway.LambdaIntegration(functions.pronunciation);
    const grammarIntegration = new apigateway.LambdaIntegration(functions.grammar);

    const publicMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
    };

    const protectedMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.authorizer,
    };

    // ===== Route Definitions =====

    // --- Auth routes (POST /auth/*) ---
    const auth = this.api.root.addResource('auth');
    const authRegister = auth.addResource('register');
    authRegister.addResource('parent').addMethod('POST', authIntegration, publicMethodOptions);
    authRegister.addResource('student').addMethod('POST', authIntegration, protectedMethodOptions);
    auth.addResource('login').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('refresh').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('forgot-password').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('verify-otp').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('reset-password').addMethod('POST', authIntegration, publicMethodOptions);
    auth.addResource('logout').addMethod('POST', authIntegration, protectedMethodOptions);

    // --- Content Store: Subjects ---
    const subjects = this.api.root.addResource('subjects');
    subjects.addMethod('GET', contentStoreIntegration, protectedMethodOptions);
    const subjectId = subjects.addResource('{subjectId}');
    const subjectBooks = subjectId.addResource('books');
    subjectBooks.addMethod('GET', contentStoreIntegration, protectedMethodOptions);
    subjectBooks.addMethod('POST', contentStoreIntegration, protectedMethodOptions);

    // --- Content Store: Books ---
    const books = this.api.root.addResource('books');
    const bookId = books.addResource('{bookId}');
    const bookChapters = bookId.addResource('chapters');
    bookChapters.addMethod('GET', contentStoreIntegration, protectedMethodOptions);
    bookChapters.addMethod('POST', contentStoreIntegration, protectedMethodOptions);

    // --- Content Store: Exercises (CRUD) ---
    const exercises = this.api.root.addResource('exercises');
    exercises.addMethod('GET', contentStoreIntegration, protectedMethodOptions);
    exercises.addMethod('POST', contentStoreIntegration, protectedMethodOptions);
    const exerciseId = exercises.addResource('{exerciseId}');
    exerciseId.addMethod('PUT', contentStoreIntegration, protectedMethodOptions);
    exerciseId.addMethod('DELETE', contentStoreIntegration, protectedMethodOptions);

    // --- Content Ingestion: Chapter pages and OCR ---
    const chapters = this.api.root.addResource('chapters');
    const chapterId = chapters.addResource('{chapterId}');
    chapterId.addResource('pages').addMethod('POST', contentIngestionIntegration, protectedMethodOptions);
    chapterId.addResource('extract').addMethod('POST', contentIngestionIntegration, protectedMethodOptions);
    chapterId.addResource('transcript').addMethod('PUT', contentIngestionIntegration, protectedMethodOptions);
    chapterId.addResource('classify-pages').addMethod('POST', contentIngestionIntegration, protectedMethodOptions);

    // --- Comprehension: Explanation, audio, revision, summary, translate ---
    const chapterExplanation = chapterId.addResource('explanation');
    chapterExplanation.addMethod('GET', comprehensionIntegration, protectedMethodOptions);
    chapterExplanation.addResource('audio').addMethod('POST', comprehensionIntegration, protectedMethodOptions);

    const revisionQuestions = chapterId.addResource('revision-questions');
    revisionQuestions.addMethod('POST', comprehensionIntegration, protectedMethodOptions);
    revisionQuestions.addMethod('GET', comprehensionIntegration, protectedMethodOptions);

    const chapterSummary = chapterId.addResource('summary');
    chapterSummary.addMethod('POST', comprehensionIntegration, protectedMethodOptions);
    chapterSummary.addMethod('GET', comprehensionIntegration, protectedMethodOptions);

    chapterId.addResource('translate').addMethod('POST', comprehensionIntegration, protectedMethodOptions);

    // --- Comprehension: Exercise assistance (hint, evaluate) ---
    exerciseId.addResource('hint').addMethod('POST', comprehensionIntegration, protectedMethodOptions);
    exerciseId.addResource('evaluate').addMethod('POST', comprehensionIntegration, protectedMethodOptions);

    // --- Progress/Sync: Progress tracking ---
    const progress = this.api.root.addResource('progress');
    const progressStudentId = progress.addResource('{studentId}');
    progressStudentId.addMethod('GET', syncIntegration, protectedMethodOptions);
    progressStudentId.addResource('streak').addMethod('GET', syncIntegration, protectedMethodOptions);
    progressStudentId.addResource('exercise-result').addMethod('POST', syncIntegration, protectedMethodOptions);

    // --- Progress/Sync: Quiz sessions ---
    const quiz = this.api.root.addResource('quiz');
    const quizSessions = quiz.addResource('sessions');
    quizSessions.addMethod('POST', syncIntegration, protectedMethodOptions);
    const quizSessionId = quizSessions.addResource('{sessionId}');
    quizSessionId.addResource('answer').addMethod('POST', syncIntegration, protectedMethodOptions);
    quizSessionId.addResource('skip').addMethod('POST', syncIntegration, protectedMethodOptions);
    quizSessionId.addResource('result').addMethod('GET', syncIntegration, protectedMethodOptions);

    // --- Pronunciation ---
    const pronunciation = this.api.root.addResource('pronunciation');
    pronunciation.addResource('record').addMethod('POST', pronunciationIntegration, protectedMethodOptions);
    pronunciation.addResource('reference').addResource('{wordId}').addMethod('GET', pronunciationIntegration, protectedMethodOptions);

    // --- Parent management ---
    const parent = this.api.root.addResource('parent');
    const parentLearners = parent.addResource('learners');
    parentLearners.addMethod('GET', authIntegration, protectedMethodOptions);
    const parentLearnerId = parentLearners.addResource('{learnerId}');
    parentLearnerId.addResource('subjects').addMethod('PUT', authIntegration, protectedMethodOptions);

    // --- Output ---
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
