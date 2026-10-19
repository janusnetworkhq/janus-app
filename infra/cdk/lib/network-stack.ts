import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import type { JanusStageProps } from "./config";

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly ecsSg: ec2.SecurityGroup;
  readonly albSg: ec2.SecurityGroup;
  readonly dataSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: JanusStageProps) {
    super(scope, id, {
      env: props.env,
      terminationProtection: props.deletionProtection,
      description: `JANUS ${props.stageName} VPC`,
    });

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: props.natGateways,
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    this.albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: this.vpc,
      description: "ALB ingress 443/80",
      allowAllOutbound: true,
    });
    this.albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");
    this.albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP redirect");

    this.ecsSg = new ec2.SecurityGroup(this, "EcsSg", {
      vpc: this.vpc,
      description: "Fargate tasks",
      allowAllOutbound: true,
    });
    this.ecsSg.addIngressRule(this.albSg, ec2.Port.tcp(3000), "ALB to API");
    this.ecsSg.addIngressRule(this.albSg, ec2.Port.tcp(3001), "ALB to web");

    this.dataSg = new ec2.SecurityGroup(this, "DataSg", {
      vpc: this.vpc,
      description: "Aurora + Redis",
      allowAllOutbound: false,
    });
    this.dataSg.addIngressRule(this.ecsSg, ec2.Port.tcp(5432), "Postgres");
    this.dataSg.addIngressRule(this.ecsSg, ec2.Port.tcp(6379), "Redis");

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
