import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import type { JanusStageProps } from "./config";
import { ComputeStack } from "./compute-stack";
import { DataStack } from "./data-stack";
import { NetworkStack } from "./network-stack";
import { WafStack } from "./waf-stack";

export class JanusStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: JanusStageProps) {
    super(scope, id, { env: props.env });

    const waf = new WafStack(this, "Waf", {
      ...props,
      env: { account: props.env.account, region: "us-east-1" },
    });
    const network = new NetworkStack(this, "Network", props);
    const data = new DataStack(this, "Data", props, network, waf);
    new ComputeStack(this, "Compute", props, network, data, waf);
  }
}
