import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
  readonly vpc?: ec2.IVpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
  readonly securityGroups?: ec2.ISecurityGroup[];
}

export class SecureLambda extends Construct {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly errorLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: SecureLambdaProps) {
    super(scope, id);

    const functionName = `learnverse-${props.stageName}-${props.serviceName}`;
    const removalPolicy = props.stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Primary log group: 30-day retention for INFO logs (Req 23.6)
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

    // Dedicated error log group: 90-day retention for ERROR logs (Req 23.6)
    this.errorLogGroup = new logs.LogGroup(this, 'ErrorLogGroup', {
      logGroupName: `/aws/lambda/${functionName}/errors`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy,
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
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      environment: {
        STAGE_NAME: props.stageName,
        ERROR_LOG_GROUP_NAME: `/aws/lambda/${functionName}/errors`,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...props.environment,
      },
    });

    // Metric filter: extract ERROR logs for CloudWatch alarms and dashboards
    new logs.MetricFilter(this, 'ErrorMetricFilter', {
      logGroup: this.logGroup,
      metricNamespace: `LearnVerse/${props.stageName}`,
      metricName: `${props.serviceName}-errors`,
      filterPattern: logs.FilterPattern.literal('"severity":"ERROR"'),
      metricValue: '1',
      defaultValue: 0,
    });
  }
}
