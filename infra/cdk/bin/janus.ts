#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { prodProps, stagingProps } from "../lib/config";
import { JanusStage } from "../lib/janus-stage";

const app = new cdk.App();
const stagingAccount =
  process.env.CDK_STAGING_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT ?? "000000000000";
const prodAccount = process.env.CDK_PROD_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT ?? "000000000000";

new JanusStage(app, "Janus-staging", stagingProps(stagingAccount));
new JanusStage(app, "Janus-prod", prodProps(prodAccount));
app.synth();
