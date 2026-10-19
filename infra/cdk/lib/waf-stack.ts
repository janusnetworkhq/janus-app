import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import type { JanusStageProps } from "./config";

/** CLOUDFRONT web ACLs must be created in us-east-1. */
export class WafStack extends cdk.Stack {
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: JanusStageProps) {
    super(scope, id, {
      env: props.env,
      crossRegionReferences: true,
      terminationProtection: props.deletionProtection,
      description: `JANUS ${props.stageName} CloudFront WAF`,
    });

    const waf = new wafv2.CfnWebACL(this, "Acl", {
      name: `janus-${props.stageName}`,
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `janus-${props.stageName}-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedCommon",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesCommonRuleSet" },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "common",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedBadInputs",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesKnownBadInputsRuleSet" },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "bad-inputs",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "IpRateLimit",
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: props.stageName === "prod" ? 10000 : 2_000_000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "ip-rate",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    this.webAclArn = waf.attrArn;
    new cdk.CfnOutput(this, "WebAclArn", { value: this.webAclArn });
  }
}
