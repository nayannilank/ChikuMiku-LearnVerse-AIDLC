import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthStack } from './AuthStack';
import { DatabaseStack } from './DatabaseStack';
import { StorageStack } from './StorageStack';
import { ComputeStack } from './ComputeStack';
import { ApiStack } from './ApiStack';
import { CdnStack } from './CdnStack';
import { ObservabilityStack } from './ObservabilityStack';

export interface LearnVerseStackProps extends cdk.StackProps {
  readonly stageName: 'qa' | 'prod';
}

export class LearnVerseStack extends cdk.Stack {
  public readonly stageName: string;

  constructor(scope: Construct, id: string, props: LearnVerseStackProps) {
    super(scope, id, props);

    this.stageName = props.stageName;

    // Apply stack-level tags
    cdk.Tags.of(this).add('learnverse:stage', props.stageName);
    cdk.Tags.of(this).add('learnverse:stack', id);

    // --- Nested stacks composed in dependency order ---

    // AuthStack (no dependencies)
    const authStack = new AuthStack(this, 'AuthStack', {
      stageName: props.stageName,
    });

    // DatabaseStack (no dependencies — provisions VPC, Aurora PostgreSQL + pgvector)
    const databaseStack = new DatabaseStack(this, 'DatabaseStack', {
      stageName: props.stageName,
    });

    // StorageStack (no dependencies — S3 buckets with lifecycle policies)
    const storageStack = new StorageStack(this, 'StorageStack', {
      stageName: props.stageName,
    });

    // ComputeStack (depends on DatabaseStack, StorageStack, AuthStack)
    // Provisions all 8 Lambda service domains with VPC connectivity to PostgreSQL
    const computeStack = new ComputeStack(this, 'ComputeStack', {
      stageName: props.stageName,
      vpc: databaseStack.vpc,
      lambdaSecurityGroup: databaseStack.lambdaSecurityGroup,
      dbCluster: databaseStack.cluster,
      contentBucket: storageStack.contentBucket,
      userPool: authStack.userPool,
      userPoolClientId: authStack.userPoolClient.userPoolClientId,
    });
    computeStack.addDependency(databaseStack);
    computeStack.addDependency(storageStack);
    computeStack.addDependency(authStack);

    // ApiStack (depends on AuthStack and ComputeStack)
    // REST API with Cognito authorizer and all 40+ endpoint routes
    const apiStack = new ApiStack(this, 'ApiStack', {
      stageName: props.stageName,
      userPool: authStack.userPool,
      functions: computeStack.functions,
    });
    apiStack.addDependency(authStack);
    apiStack.addDependency(computeStack);

    // CdnStack (depends on StorageStack)
    // CloudFront distributions for web app and content assets
    const cdnStack = new CdnStack(this, 'CdnStack', {
      stageName: props.stageName,
      webAppBucket: storageStack.webAppBucket,
      contentBucket: storageStack.contentBucket,
    });
    cdnStack.addDependency(storageStack);

    // ObservabilityStack (depends on ComputeStack)
    const observabilityStack = new ObservabilityStack(this, 'ObservabilityStack', {
      stageName: props.stageName,
      functions: computeStack.functions,
    });
    observabilityStack.addDependency(computeStack);
  }

  /**
   * Returns a standardized resource name following the convention:
   * learnverse-{stageName}-{suffix}
   */
  public resourceName(suffix: string): string {
    return `learnverse-${this.stageName}-${suffix}`;
  }
}
