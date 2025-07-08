#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyServerlessAppStack } from '../lib/my-serverless-app-stack';

const app = new cdk.App();
new MyServerlessAppStack(app, 'MyServerlessAppStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});


