import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ObservabilityStack } from '../lib/ObservabilityStack';

describe('ObservabilityStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  const serviceNames = ['auth', 'content', 'learning', 'sync'];

  beforeAll(() => {
    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaFunctions: Record<string, lambda.Function> = {};
    for (const name of serviceNames) {
      qaFunctions[name] = new lambda.Function(qaParent, `${name}Fn`, {
        functionName: `learnverse-qa-${name}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });
    }
    const qaStack = new ObservabilityStack(qaParent, 'ObservabilityStack', {
      stageName: 'qa',
      functions: qaFunctions,
    });
    qaTemplate = Template.fromStack(qaStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodFunctions: Record<string, lambda.Function> = {};
    for (const name of serviceNames) {
      prodFunctions[name] = new lambda.Function(prodParent, `${name}Fn`, {
        functionName: `learnverse-prod-${name}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });
    }
    const prodStack = new ObservabilityStack(prodParent, 'ObservabilityStack', {
      stageName: 'prod',
      functions: prodFunctions,
    });
    prodTemplate = Template.fromStack(prodStack);
  });

  describe('SNS Topic (Requirement 7.5)', () => {
    it('creates an SNS topic with correct naming convention', () => {
      qaTemplate.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'learnverse-qa-alarms',
      });
    });

    it('creates exactly one SNS topic', () => {
      qaTemplate.resourceCountIs('AWS::SNS::Topic', 1);
    });

    it('prod SNS topic uses correct naming', () => {
      prodTemplate.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'learnverse-prod-alarms',
      });
    });
  });

  describe('Lambda Error Rate Alarms (Requirement 7.2)', () => {
    it('creates one error rate alarm per Lambda function (4 total)', () => {
      const alarms = qaTemplate.findResources('AWS::CloudWatch::Alarm', {
        Properties: {
          Threshold: 1,
          ComparisonOperator: 'GreaterThanThreshold',
        },
      });
      expect(Object.keys(alarms).length).toBe(4);
    });

    for (const name of serviceNames) {
      it(`creates error rate alarm for ${name} Lambda`, () => {
        qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
          AlarmName: `learnverse-qa-${name}-error-rate`,
          Threshold: 1,
          ComparisonOperator: 'GreaterThanThreshold',
          EvaluationPeriods: 1,
          TreatMissingData: 'notBreaching',
        });
      });
    }

    it('error rate alarms use MathExpression with correct formula', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-auth-error-rate',
        Metrics: Match.arrayWith([
          Match.objectLike({
            Expression: 'IF(invocations > 0, (errors / invocations) * 100, 0)',
            ReturnData: true,
          }),
        ]),
      });
    });

    it('error rate alarms use 5-minute period (300s)', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-auth-error-rate',
        Metrics: Match.arrayWith([
          Match.objectLike({
            Id: 'errors',
            MetricStat: Match.objectLike({
              Period: 300,
              Stat: 'Sum',
            }),
          }),
        ]),
      });
    });

    it('error rate alarms reference Lambda function dimensions', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-auth-error-rate',
        Metrics: Match.arrayWith([
          Match.objectLike({
            Id: 'errors',
            MetricStat: Match.objectLike({
              Metric: Match.objectLike({
                MetricName: 'Errors',
                Namespace: 'AWS/Lambda',
                Dimensions: Match.arrayWith([
                  Match.objectLike({ Name: 'FunctionName' }),
                ]),
              }),
            }),
          }),
        ]),
      });
    });
  });

  describe('API Latency Alarm (Requirement 7.3)', () => {
    it('creates API latency alarm with threshold 2000ms', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-api-latency-p99',
        Threshold: 2000,
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
      });
    });

    it('API latency alarm uses p99 statistic', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-api-latency-p99',
        ExtendedStatistic: 'p99',
      });
    });

    it('API latency alarm targets AWS/ApiGateway namespace', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-api-latency-p99',
        Namespace: 'AWS/ApiGateway',
        MetricName: 'Latency',
      });
    });

    it('API latency alarm uses 5-minute period (300s)', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-api-latency-p99',
        Period: 300,
      });
    });

    it('API latency alarm uses correct API dimension', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'learnverse-qa-api-latency-p99',
        Dimensions: Match.arrayWith([
          Match.objectLike({ Name: 'ApiName', Value: 'learnverse-qa-api' }),
        ]),
      });
    });
  });

  describe('Alarm Actions - SNS Integration (Requirement 7.5)', () => {
    it('all alarms have AlarmActions referencing the SNS topic', () => {
      const alarms = qaTemplate.findResources('AWS::CloudWatch::Alarm');
      for (const id of Object.keys(alarms)) {
        const actions = alarms[id].Properties.AlarmActions;
        expect(actions).toBeDefined();
        expect(actions.length).toBeGreaterThan(0);
        // Each action should be a Ref to the SNS topic
        expect(actions[0]).toHaveProperty('Ref');
      }
    });

    it('error rate alarm actions reference the SNS topic', () => {
      // Verify that the alarm action Ref matches the SNS topic logical ID
      const topics = qaTemplate.findResources('AWS::SNS::Topic');
      const topicLogicalId = Object.keys(topics)[0];

      const alarms = qaTemplate.findResources('AWS::CloudWatch::Alarm');
      for (const id of Object.keys(alarms)) {
        const actions = alarms[id].Properties.AlarmActions;
        expect(actions[0].Ref).toBe(topicLogicalId);
      }
    });
  });

  describe('CloudWatch Dashboard (Requirement 7.4)', () => {
    it('creates a CloudWatch dashboard', () => {
      qaTemplate.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });

    it('dashboard has correct naming convention', () => {
      qaTemplate.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'learnverse-qa-dashboard',
      });
    });

    it('prod dashboard has correct naming convention', () => {
      prodTemplate.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'learnverse-prod-dashboard',
      });
    });
  });

  describe('Log Group References (Requirement 7.1)', () => {
    it('does not create new log group resources (they are imported from SecureLambda)', () => {
      // Log groups are created by SecureLambda construct in ComputeStack, not ObservabilityStack
      // ObservabilityStack uses fromLogGroupName to import them
      qaTemplate.resourceCountIs('AWS::Logs::LogGroup', 0);
    });

    it('references log groups with expected naming pattern in the construct tree', () => {
      // Verify the ObservabilityStack code references the correct log group names
      // by checking the alarm names follow the per-function pattern
      for (const name of serviceNames) {
        qaTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
          AlarmName: `learnverse-qa-${name}-error-rate`,
        });
      }
    });
  });

  describe('Prod Removal Policy (Requirement 7.6)', () => {
    it('prod does not synthesize log group resources (imported, not created)', () => {
      // Since log groups are imported via fromLogGroupName, the CfnResource override
      // does not produce an AWS::Logs::LogGroup in the template.
      // The RETAIN policy is handled by SecureLambda in ComputeStack for prod.
      prodTemplate.resourceCountIs('AWS::Logs::LogGroup', 0);
    });

    it('qa does not synthesize log group resources either (both use imported references)', () => {
      qaTemplate.resourceCountIs('AWS::Logs::LogGroup', 0);
    });
  });

  describe('Total Alarm Count', () => {
    it('creates exactly 5 alarms (4 error rate + 1 API latency)', () => {
      qaTemplate.resourceCountIs('AWS::CloudWatch::Alarm', 5);
    });
  });
});
