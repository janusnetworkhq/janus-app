import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import type { JanusStageProps } from "./config";
import type { DataStack } from "./data-stack";
import type { NetworkStack } from "./network-stack";
import type { WafStack } from "./waf-stack";

export class ComputeStack extends cdk.Stack {
  readonly cluster: ecs.Cluster;
  readonly alb: elbv2.ApplicationLoadBalancer;
  readonly apiTarget: elbv2.ApplicationTargetGroup;
  readonly apiRepo: ecr.Repository;
  readonly webRepo: ecr.Repository;

  constructor(
    scope: Construct,
    id: string,
    props: JanusStageProps,
    network: NetworkStack,
    data: DataStack,
    waf: WafStack,
  ) {
    super(scope, id, {
      env: props.env,
      crossRegionReferences: true,
      terminationProtection: props.deletionProtection,
      description: `JANUS ${props.stageName} ECS`,
    });

    this.apiRepo = new ecr.Repository(this, "ApiRepo", {
      repositoryName: `janus-api-${props.stageName}`,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 20 }],
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: !props.deletionProtection,
    });
    this.webRepo = new ecr.Repository(this, "WebRepo", {
      repositoryName: `janus-web-${props.stageName}`,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 15 }],
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: !props.deletionProtection,
    });

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: network.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      clusterName: `janus-${props.stageName}`,
    });

    const apiLog = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "JANUS API/worker — vault, queues, KMS decrypt",
    });
    data.uploads.grantReadWrite(taskRole);
    data.publicMedia.grantReadWrite(taskRole);
    data.vault.grantReadWrite(taskRole);
    data.vaultKey.grantEncryptDecrypt(taskRole);
    data.transcodeQueue.grantSendMessages(taskRole);
    data.transcodeQueue.grantConsumeMessages(taskRole);
    data.ndaQueue.grantSendMessages(taskRole);
    data.ndaQueue.grantConsumeMessages(taskRole);
    data.notifyQueue.grantSendMessages(taskRole);
    data.notifyQueue.grantConsumeMessages(taskRole);
    data.cluster.secret?.grantRead(taskRole);

    const mediaConvertRole = new iam.Role(this, "MediaConvertRole", {
      assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
      description: "MediaConvert reads uploads and writes HLS",
    });
    data.uploads.grantRead(mediaConvertRole);
    data.publicMedia.grantReadWrite(mediaConvertRole);
    data.vault.grantReadWrite(mediaConvertRole);
    data.vaultKey.grantEncryptDecrypt(mediaConvertRole);

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "MediaConvertJobs",
        actions: [
          "mediaconvert:CreateJob",
          "mediaconvert:GetJob",
          "mediaconvert:DescribeEndpoints",
          "mediaconvert:ListJobs",
        ],
        resources: ["*"],
      }),
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "MediaConvertPassRole",
        actions: ["iam:PassRole"],
        resources: [mediaConvertRole.roleArn],
        conditions: { StringEquals: { "iam:PassedToService": "mediaconvert.amazonaws.com" } },
      }),
    );
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "RekognitionModeration",
        actions: ["rekognition:DetectModerationLabels"],
        resources: ["*"],
      }),
    );

    const execRole = new iam.Role(this, "ExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });
    data.cluster.secret?.grantRead(execRole);

    const environment = {
      NODE_ENV: "production",
      APP_ENV: props.stageName,
      PORT: "3000",
      AUTH_MODE: "cognito",
      AWS_REGION: props.env.region,
      COGNITO_REGION: props.env.region,
      COGNITO_USER_POOL_ID: data.userPool.userPoolId,
      COGNITO_CLIENT_ID: data.userPoolClient.userPoolClientId,
      S3_UPLOADS_BUCKET: data.uploads.bucketName,
      S3_PUBLIC_MEDIA_BUCKET: data.publicMedia.bucketName,
      S3_VAULT_BUCKET: data.vault.bucketName,
      SQS_MEDIA_TRANSCODE_URL: data.transcodeQueue.queueUrl,
      SQS_NDA_LIFECYCLE_URL: data.ndaQueue.queueUrl,
      SQS_NOTIFY_SEND_URL: data.notifyQueue.queueUrl,
      MEDIA_DRIVER: "s3",
      TRANSCODE_DRIVER: "ffmpeg",
      MODERATION_DRIVER: "rekognition",
      REDIS_HOST: data.redis.attrPrimaryEndPointAddress,
      PGHOST: data.cluster.clusterEndpoint.hostname,
      PGPORT: "5432",
      PGDATABASE: "janus",
      MEDIA_PUBLIC_BASE: `https://${data.mediaDomain}`,
      MEDIA_CONVERT_QUEUE: data.mediaConvertQueue.attrArn,
      MEDIA_CONVERT_ROLE_ARN: mediaConvertRole.roleArn,
      CORS_ORIGINS: props.domainName
        ? `https://${props.domainName},https://app.${props.domainName}`
        : "https://localhost:3001",
    };

    const secrets: Record<string, ecs.Secret> = {};
    if (data.cluster.secret) {
      secrets.PGUSER = ecs.Secret.fromSecretsManager(data.cluster.secret, "username");
      secrets.PGPASSWORD = ecs.Secret.fromSecretsManager(data.cluster.secret, "password");
    }

    const apiTask = new ecs.FargateTaskDefinition(this, "ApiTask", {
      cpu: props.apiCpu,
      memoryLimitMiB: props.apiMemory,
      taskRole,
      executionRole: execRole,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    apiTask.addContainer("api", {
      image: ecs.ContainerImage.fromEcrRepository(this.apiRepo, props.imageTag),
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLog, streamPrefix: "api" }),
      environment: { ...environment, WORKERS_ENABLED: "false" },
      secrets,
      portMappings: [{ containerPort: 3000 }],
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/ready >/dev/null || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(40),
      },
    });

    const workerTask = new ecs.FargateTaskDefinition(this, "WorkerTask", {
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole,
      executionRole: execRole,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    workerTask.addContainer("worker", {
      image: ecs.ContainerImage.fromEcrRepository(this.apiRepo, props.imageTag),
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLog, streamPrefix: "worker" }),
      environment: { ...environment, WORKERS_ENABLED: "true" },
      secrets,
    });

    this.alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: network.vpc,
      internetFacing: true,
      securityGroup: network.albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    this.apiTarget = new elbv2.ApplicationTargetGroup(this, "ApiTg", {
      vpc: network.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/ready",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
      },
      deregistrationDelay: cdk.Duration.seconds(20),
    });

    this.alb.addListener("Http", {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.forward([this.apiTarget]),
    });

    const apiCdn = new cloudfront.Distribution(this, "ApiCdn", {
      comment: `JANUS ${props.stageName} API`,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(this.alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      webAclId: waf.webAclArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    const apiService = new ecs.FargateService(this, "ApiService", {
      cluster: this.cluster,
      taskDefinition: apiTask,
      desiredCount: props.apiDesiredCount,
      securityGroups: [network.ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      enableExecuteCommand: props.stageName === "staging",
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });
    this.apiTarget.addTarget(apiService);

    new ecs.FargateService(this, "WorkerService", {
      cluster: this.cluster,
      taskDefinition: workerTask,
      desiredCount: props.workerDesiredCount,
      securityGroups: [network.ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
    });

    const scaling = apiService.autoScaleTaskCount({
      minCapacity: props.apiDesiredCount,
      maxCapacity: props.stageName === "prod" ? 8 : 3,
    });
    scaling.scaleOnCpuUtilization("Cpu", { targetUtilizationPercent: 60 });
    scaling.scaleOnRequestCount("Rps", {
      requestsPerTarget: 400,
      targetGroup: this.apiTarget,
    });

    const topic = new sns.Topic(this, "Alarms", { displayName: `janus-${props.stageName}-ops` });
    const p95 = new cloudwatch.Alarm(this, "FeedP95", {
      alarmDescription: "ALB target p95 > 300ms — feed SLO burn",
      metric: this.apiTarget.metrics.targetResponseTime({ statistic: "p95", period: cdk.Duration.minutes(5) }),
      threshold: 0.3,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    p95.addAlarmAction(new cw_actions.SnsAction(topic));

    const fiveXx = new cloudwatch.Alarm(this, "Alb5xx", {
      alarmDescription: "Availability SLO — ALB 5XX",
      metric: this.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
      }),
      threshold: 20,
      evaluationPeriods: 5,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    fiveXx.addAlarmAction(new cw_actions.SnsAction(topic));

    new cloudwatch.Alarm(this, "AuroraCpu", {
      alarmDescription: "Aurora CPU — scale ACU before feed SLO burns",
      metric: data.cluster.metricCPUUtilization({ period: cdk.Duration.minutes(5) }),
      threshold: 80,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(topic));

    new cloudwatch.Alarm(this, "RedisEvictions", {
      alarmDescription: "Redis evictions — feed cache too small",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ElastiCache",
        metricName: "Evictions",
        dimensionsMap: { ReplicationGroupId: data.redisGroupId },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(topic));

    new cloudwatch.Alarm(this, "UnhealthyHosts", {
      metric: this.apiTarget.metrics.unhealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
    }).addAlarmAction(new cw_actions.SnsAction(topic));

    new cdk.CfnOutput(this, "AlbDns", { value: this.alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, "ApiDomain", { value: apiCdn.distributionDomainName });
    new cdk.CfnOutput(this, "ApiRepoUri", { value: this.apiRepo.repositoryUri });
    new cdk.CfnOutput(this, "WebRepoUri", { value: this.webRepo.repositoryUri });
  }
}
