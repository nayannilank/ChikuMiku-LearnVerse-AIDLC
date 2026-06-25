import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.NestedStackProps {
  readonly stageName: string;
}

export class DatabaseStack extends cdk.NestedStack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { stageName } = props;
    const isProd = stageName === 'prod';

    // VPC for database and Lambda networking
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `learnverse-${stageName}-vpc`,
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private-lambda',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'private-db',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security group for Lambda functions connecting to the database
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
      securityGroupName: `learnverse-${stageName}-lambda-sg`,
      description: 'Security group for Lambda functions accessing PostgreSQL',
      allowAllOutbound: true,
    });

    // Security group for the database cluster
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: this.vpc,
      securityGroupName: `learnverse-${stageName}-db-sg`,
      description: 'Security group for Aurora PostgreSQL cluster',
      allowAllOutbound: false,
    });

    // Allow inbound PostgreSQL traffic from Lambda security group only
    this.dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from Lambda functions',
    );

    // Aurora Serverless v2 PostgreSQL cluster with pgvector support
    this.cluster = new rds.DatabaseCluster(this, 'PostgresCluster', {
      clusterIdentifier: `learnverse-${stageName}-pg`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: isProd ? 1 : 0.5,
      serverlessV2MaxCapacity: isProd ? 16 : 4,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      readers: isProd
        ? [rds.ClusterInstance.serverlessV2('reader', { scaleWithWriter: true })]
        : [],
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      defaultDatabaseName: 'learnverse',
      credentials: rds.Credentials.fromGeneratedSecret('learnverse_admin', {
        secretName: `learnverse-${stageName}-db-credentials`,
      }),
      storageEncrypted: true,
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      backup: {
        retention: isProd ? cdk.Duration.days(30) : cdk.Duration.days(7),
      },
    });

    // Outputs for cross-stack references
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora PostgreSQL cluster endpoint',
    });

    new cdk.CfnOutput(this, 'ClusterSecretArn', {
      value: this.cluster.secret?.secretArn ?? '',
      description: 'Database credentials secret ARN',
    });
  }
}
