#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LearnVerseStack } from '../lib/LearnVerseStack';
import { CiCdStack } from '../lib/CiCdStack';

const app = new cdk.App();

const env: cdk.Environment = {
  region: 'ap-south-1',
};

new LearnVerseStack(app, 'LearnVerseStack-qa', {
  stageName: 'qa',
  env,
});

new LearnVerseStack(app, 'LearnVerseStack-prod', {
  stageName: 'prod',
  env,
});

// CI/CD stack with GitHub OIDC role (shared across environments)
new CiCdStack(app, 'LearnVerse-CiCdStack', {
  env,
  githubRepo: app.node.tryGetContext('githubRepo') || 'NayanKhedkar/LearnVerse-LearnVerse',
});

app.synth();
