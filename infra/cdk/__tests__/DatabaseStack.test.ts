import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/DatabaseStack';

describe('DatabaseStack', () => {
  let qaTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    // QA environment stack
    const qaApp = new cdk.App();
    const qaParent = new cdk.Stack(qaApp, 'QaParent');
    const qaDatabaseStack = new DatabaseStack(qaParent, 'DatabaseStack', {
      stageName: 'qa',
    });
    qaTemplate = Template.fromStack(qaDatabaseStack);

    // Prod environment stack
    const prodApp = new cdk.App();
    const prodParent = new cdk.Stack(prodApp, 'ProdParent');
    const prodDatabaseStack = new DatabaseStack(prodParent, 'DatabaseStack', {
      stageName: 'prod',
    });
    prodTemplate = Template.fromStack(prodDatabaseStack);
  });

  describe('VPC Configuration (Requirement 8.1)', () => {
    it('creates a VPC with public, private-lambda, and private-db subnets', () => {
      qaTemplate.hasResourceProperties('AWS::EC2::Subnet', {
        Tags: Match.arrayWith([
          Match.objectLike({ Key: 'aws-cdk:subnet-name', Value: 'public' }),
        ]),
      });
      qaTemplate.hasResourceProperties('AWS::EC2::Subnet', {
        Tags: Match.arrayWith([
          Match.objectLike({ Key: 'aws-cdk:subnet-name', Value: 'private-lambda' }),
        ]),
      });
      qaTemplate.hasResourceProperties('AWS::EC2::Subnet', {
        Tags: Match.arrayWith([
          Match.objectLike({ Key: 'aws-cdk:subnet-name', Value: 'private-db' }),
        ]),
      });
    });

    it('creates 1 NAT gateway in qa', () => {
      qaTemplate.resourceCountIs('AWS::EC2::NatGateway', 1);
    });

    it('creates 2 NAT gateways in prod', () => {
      prodTemplate.resourceCountIs('AWS::EC2::NatGateway', 2);
    });
  });

  describe('Security Groups (Requirement 8.2)', () => {
    it('creates a Lambda security group', () => {
      qaTemplate.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Lambda functions accessing PostgreSQL',
      });
    });

    it('creates a Database security group', () => {
      qaTemplate.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Aurora PostgreSQL cluster',
      });
    });

    it('allows inbound PostgreSQL traffic (port 5432) from Lambda SG to Database SG', () => {
      qaTemplate.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
      });
    });
  });

  describe('Aurora PostgreSQL Cluster (Requirement 8.3)', () => {
    it('creates an Aurora Serverless v2 PostgreSQL cluster', () => {
      qaTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        Engine: 'aurora-postgresql',
        DatabaseName: 'learnverse',
      });
    });

    it('uses PostgreSQL version 16.4', () => {
      qaTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        EngineVersion: '16.4',
      });
    });

    it('enables storage encryption', () => {
      qaTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        StorageEncrypted: true,
      });
    });
  });

  describe('Environment-Specific Configuration (Requirement 8.4)', () => {
    it('disables deletion protection in qa', () => {
      qaTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        DeletionProtection: false,
      });
    });

    it('enables deletion protection in prod', () => {
      prodTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        DeletionProtection: true,
      });
    });

    it('sets DESTROY removal policy for cluster in qa', () => {
      qaTemplate.hasResource('AWS::RDS::DBCluster', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    it('sets RETAIN removal policy for cluster in prod', () => {
      prodTemplate.hasResource('AWS::RDS::DBCluster', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });

  describe('Backup Configuration (Requirement 8.5)', () => {
    it('sets backup retention to 7 days in qa', () => {
      qaTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        BackupRetentionPeriod: 7,
      });
    });

    it('sets backup retention to 30 days in prod', () => {
      prodTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
        BackupRetentionPeriod: 30,
      });
    });
  });

  describe('Outputs (Requirement 8.6)', () => {
    it('exports ClusterEndpoint output', () => {
      const outputs = qaTemplate.findOutputs('*');
      const outputKeys = Object.keys(outputs);
      expect(outputKeys.some(k => k.includes('ClusterEndpoint'))).toBe(true);
    });

    it('exports ClusterSecretArn output', () => {
      const outputs = qaTemplate.findOutputs('*');
      const outputKeys = Object.keys(outputs);
      expect(outputKeys.some(k => k.includes('ClusterSecretArn'))).toBe(true);
    });
  });
});
