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

  describe('Key Schema (Requirement 8.1, 8.2, 8.3)', () => {
    it('learners table has pk as partition key and sk as sort key', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-learners',
        KeySchema: Match.arrayWith([
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ]),
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ]),
      });
    });

    it('accounts table has pk as partition key and sk as sort key', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        KeySchema: Match.arrayWith([
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ]),
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ]),
      });
    });

    it('content table has pk as partition key and sk as sort key', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-content',
        KeySchema: Match.arrayWith([
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ]),
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ]),
      });
    });
  });

  describe('PAY_PER_REQUEST Billing Mode (Requirement 8.1, 8.2, 8.3)', () => {
    it('learners table uses PAY_PER_REQUEST billing', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-learners',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    it('accounts table uses PAY_PER_REQUEST billing', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    it('content table uses PAY_PER_REQUEST billing', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-content',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });
  });

  describe('GSIs on Accounts Table (Requirement 8.2)', () => {
    it('accounts table has username-index GSI with username partition key', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'username-index',
            KeySchema: [
              { AttributeName: 'username', KeyType: 'HASH' },
            ],
          }),
        ]),
      });
    });

    it('accounts table has email-index GSI with email partition key', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'email-index',
            KeySchema: [
              { AttributeName: 'email', KeyType: 'HASH' },
            ],
          }),
        ]),
      });
    });

    it('username and email attributes are defined as String type', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'username', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' },
        ]),
      });
    });
  });

  describe('Point-in-Time Recovery (Requirement 8.4)', () => {
    it('learners table has Point-in-Time Recovery enabled', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-learners',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    it('accounts table has Point-in-Time Recovery enabled', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-accounts',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    it('content table has Point-in-Time Recovery enabled', () => {
      qaTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'learnverse-qa-content',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });
  });

  describe('Removal Policy Per Environment (Requirement 8.5)', () => {
    it('sets DESTROY removal policy for all tables in qa', () => {
      qaTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-qa-learners' },
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });

      qaTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-qa-accounts' },
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });

      qaTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-qa-content' },
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    it('sets RETAIN removal policy for all tables in prod', () => {
      prodTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-prod-learners' },
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });

      prodTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-prod-accounts' },
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });

      prodTemplate.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'learnverse-prod-content' },
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });
});
