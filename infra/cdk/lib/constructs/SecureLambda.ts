import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface SecureLambdaProps {
  readonly serviceName: string;
  readonly stageName: string;
  readonly codePath: string;
  readonly handler: string;
  readonly environment?: Record<string, string>;
  readonly memorySize?: number;  // default: 256
  readonly timeout?: number;     // default: 30
}

export class SecureLambda extends Construct {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: SecureLambdaProps) {
    super(scope, id);

    const functionName = `learnverse-${props.stageName}-${props.serviceName}`;

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: props.stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.function = new lambda.Function(this, 'Function', {
      functionName,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: props.handler,
      code: lambda.Code.fromAsset(props.codePath),
      memorySize: props.memorySize ?? 256,
      timeout: cdk.Duration.seconds(props.timeout ?? 30),
      tracing: lambda.Tracing.ACTIVE,
      logGroup: this.logGroup,
      environment: {
        STAGE_NAME: props.stageName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...props.environment,
      },
    });
  }
}
