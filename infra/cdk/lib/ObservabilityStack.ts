import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
  readonly functions: Record<string, lambda.Function>;
}

export class ObservabilityStack extends cdk.NestedStack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { stageName, functions } = props;
    const apiName = `chikumiku-${stageName}-api`;

    // --- SNS Topic for alarm notifications ---
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `chikumiku-${stageName}-alarms`,
    });

    // --- Per-Lambda alarms: error rate > 1% (5-min period) ---
    const dashboardWidgets: cloudwatch.IWidget[][] = [];
    const errorRateWidgets: cloudwatch.IWidget[] = [];
    const invocationWidgets: cloudwatch.IWidget[] = [];

    for (const [serviceName, fn] of Object.entries(functions)) {
      const functionName = `chikumiku-${stageName}-${serviceName}`;

      // Reference the existing log group created by SecureLambda
      const logGroup = logs.LogGroup.fromLogGroupName(
        this,
        `${serviceName}LogGroup`,
        `/aws/lambda/${functionName}`,
      );

      // Apply RETAIN removal policy for prod log groups
      // Since we're importing existing log groups, we apply the policy via a CfnResource override
      if (stageName === 'prod') {
        const cfnLogGroup = logGroup.node.defaultChild as cdk.CfnResource | undefined;
        if (cfnLogGroup) {
          cfnLogGroup.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        }
      }

      // Lambda error rate alarm: errors > 1% of invocations over 5 minutes
      const errorsMetric = fn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const invocationsMetric = fn.metricInvocations({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const errorRateAlarm = new cloudwatch.MathExpression({
        expression: 'IF(invocations > 0, (errors / invocations) * 100, 0)',
        usingMetrics: {
          errors: errorsMetric,
          invocations: invocationsMetric,
        },
        period: cdk.Duration.minutes(5),
        label: `${serviceName} Error Rate (%)`,
      }).createAlarm(this, `${serviceName}ErrorRateAlarm`, {
        alarmName: `chikumiku-${stageName}-${serviceName}-error-rate`,
        alarmDescription: `Lambda ${serviceName} error rate exceeds 1%`,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Dashboard widgets for this function
      errorRateWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${serviceName} Error Rate`,
          left: [errorsMetric],
          right: [invocationsMetric],
          width: 6,
        }),
      );

      invocationWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${serviceName} Invocations`,
          left: [invocationsMetric],
          width: 6,
        }),
      );
    }

    // --- API Gateway latency alarm: p99 > 2000ms (5-min period) ---
    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: apiName,
      },
      statistic: 'p99',
      period: cdk.Duration.minutes(5),
    });

    const apiLatencyAlarm = apiLatencyMetric.createAlarm(this, 'ApiLatencyAlarm', {
      alarmName: `chikumiku-${stageName}-api-latency-p99`,
      alarmDescription: `API Gateway p99 latency exceeds 2000ms`,
      threshold: 2000,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // --- CloudWatch Dashboard ---
    dashboardWidgets.push(errorRateWidgets);
    dashboardWidgets.push(invocationWidgets);
    dashboardWidgets.push([
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency (p99)',
        left: [apiLatencyMetric],
        width: 12,
      }),
    ]);

    new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `chikumiku-${stageName}-dashboard`,
      widgets: dashboardWidgets,
    });
  }
}
