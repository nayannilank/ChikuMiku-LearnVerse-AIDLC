import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthStack } from './AuthStack';
import { DatabaseStack } from './DatabaseStack';
import { StorageStack } from './StorageStack';
import { ApiStack } from './ApiStack';
import { LambdaStack } from './LambdaStack';
import { ObservabilityStack } from './ObservabilityStack';

export interface ChikuMikuStackProps extends cdk.StackProps {
  readonly stageName: 'qa' | 'prod';
}

export class ChikuMikuStack extends cdk.Stack {
  public readonly stageName: string;

  constructor(scope: Construct, id: string, props: ChikuMikuStackProps) {
    super(scope, id, props);

    this.stageName = props.stageName;

    // Apply stack-level tags
    cdk.Tags.of(this).add('chikumiku:stage', props.stageName);
    cdk.Tags.of(this).add('chikumiku:stack', id);

    // --- Nested stacks composed in dependency order ---

    // AuthStack (no dependencies)
    const authStack = new AuthStack(this, 'AuthStack', {
      stageName: props.stageName,
    });

    // DatabaseStack (no dependencies)
    const databaseStack = new DatabaseStack(this, 'DatabaseStack', {
      stageName: props.stageName,
    });

    // StorageStack (no dependencies)
    const storageStack = new StorageStack(this, 'StorageStack', {
      stageName: props.stageName,
    });

    // ApiStack (depends on AuthStack.userPool)
    const apiStack = new ApiStack(this, 'ApiStack', {
      stageName: props.stageName,
      userPool: authStack.userPool,
    });
    apiStack.addDependency(authStack);

    // LambdaStack (depends on DatabaseStack, StorageStack, ApiStack, AuthStack)
    const lambdaStack = new LambdaStack(this, 'LambdaStack', {
      stageName: props.stageName,
      tables: {
        learnersTable: databaseStack.learnersTable,
        accountsTable: databaseStack.accountsTable,
        contentTable: databaseStack.contentTable,
      },
      contentBucket: storageStack.contentBucket,
      api: apiStack.api,
      authorizer: apiStack.authorizer,
      userPool: authStack.userPool,
      userPoolClientId: authStack.userPoolClient.userPoolClientId,
    });
    lambdaStack.addDependency(databaseStack);
    lambdaStack.addDependency(storageStack);
    lambdaStack.addDependency(apiStack);
    lambdaStack.addDependency(authStack);

    // ObservabilityStack (depends on LambdaStack.functions)
    const observabilityStack = new ObservabilityStack(this, 'ObservabilityStack', {
      stageName: props.stageName,
      functions: lambdaStack.functions,
    });
    observabilityStack.addDependency(lambdaStack);
  }

  /**
   * Returns a standardized resource name following the convention:
   * chikumiku-{stageName}-{suffix}
   */
  public resourceName(suffix: string): string {
    return `chikumiku-${this.stageName}-${suffix}`;
  }
}
