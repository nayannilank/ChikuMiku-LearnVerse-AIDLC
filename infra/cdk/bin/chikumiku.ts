#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ChikuMikuStack } from '../lib/ChikuMikuStack';
import { CiCdStack } from '../lib/CiCdStack';

const app = new cdk.App();

const env: cdk.Environment = {
  region: 'ap-south-1',
};

new ChikuMikuStack(app, 'ChikuMikuStack-qa', {
  stageName: 'qa',
  env,
});

new ChikuMikuStack(app, 'ChikuMikuStack-prod', {
  stageName: 'prod',
  env,
});

// CI/CD stack with GitHub OIDC role (shared across environments)
new CiCdStack(app, 'ChikuMiku-CiCdStack', {
  env,
  githubRepo: app.node.tryGetContext('githubRepo') || 'NayanKhedkar/ChikuMiku-LearnVerse',
});

app.synth();
