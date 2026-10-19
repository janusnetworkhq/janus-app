import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as kms from "aws-cdk-lib/aws-kms";
import * as mediaconvert from "aws-cdk-lib/aws-mediaconvert";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import type { JanusStageProps } from "./config";
import type { NetworkStack } from "./network-stack";
import type { WafStack } from "./waf-stack";

export class DataStack extends cdk.Stack {
  readonly vaultKey: kms.Key;
  readonly uploads: s3.Bucket;
  readonly publicMedia: s3.Bucket;
  readonly vault: s3.Bucket;
  readonly cluster: rds.DatabaseCluster;
  readonly redis: elasticache.CfnReplicationGroup;
  readonly transcodeQueue: sqs.Queue;
  readonly ndaQueue: sqs.Queue;
  readonly notifyQueue: sqs.Queue;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly mediaConvertQueue: mediaconvert.CfnQueue;
  readonly redisGroupId: string;
  readonly mediaDomain: string;

  constructor(
    scope: Construct,
    id: string,
    props: JanusStageProps,
    network: NetworkStack,
    waf: WafStack,
  ) {
    super(scope, id, {
      env: props.env,
      crossRegionReferences: true,
      terminationProtection: props.deletionProtection,
      description: `JANUS ${props.stageName} data plane`,
    });

    this.vaultKey = new kms.Key(this, "VaultCmk", {
      alias: `alias/janus-vault-${props.stageName}`,
      enableKeyRotation: true,
      description: "JANUS vault SSE-KMS CMK — API/worker roles only",
    });

    this.uploads = new s3.Bucket(this, "Uploads", {
      bucketName: `janus-${props.stageName}-uploads-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.deletionProtection,
    });

    this.publicMedia = new s3.Bucket(this, "PublicMedia", {
      bucketName: `janus-${props.stageName}-public-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const mediaCdn = new cloudfront.Distribution(this, "PublicMediaCdn", {
      comment: `JANUS ${props.stageName} HLS`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.publicMedia),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      webAclId: waf.webAclArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });
    this.mediaDomain = mediaCdn.distributionDomainName;

    this.vault = new s3.Bucket(this, "Vault", {
      bucketName: `janus-${props.stageName}-vault-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.vaultKey,
      bucketKeyEnabled: true,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.transcodeQueue = new sqs.Queue(this, "MediaTranscode", {
      queueName: `janus-${props.stageName}-media-transcode`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: cdk.Duration.minutes(5),
    });
    this.ndaQueue = new sqs.Queue(this, "NdaLifecycle", {
      queueName: `janus-${props.stageName}-nda-lifecycle`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    this.notifyQueue = new sqs.Queue(this, "NotifySend", {
      queueName: `janus-${props.stageName}-notify-send`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.mediaConvertQueue = new mediaconvert.CfnQueue(this, "MediaConvert", {
      name: `janus-${props.stageName}`,
      pricingPlan: "ON_DEMAND",
    });

    this.cluster = new rds.DatabaseCluster(this, "Aurora", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: props.auroraMinAcu,
      serverlessV2MaxCapacity: props.auroraMaxAcu,
      defaultDatabaseName: "janus",
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [network.dataSg],
      storageEncrypted: true,
      backup: { retention: cdk.Duration.days(props.backupDays), preferredWindow: "19:00-20:00" },
      deletionProtection: props.deletionProtection,
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
      credentials: rds.Credentials.fromGeneratedSecret("janus", { secretName: `janus/${props.stageName}/aurora` }),
      cloudwatchLogsExports: ["postgresql"],
    });

    const redisSubnet = new elasticache.CfnSubnetGroup(this, "RedisSubnets", {
      description: "JANUS Redis",
      subnetIds: network.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `janus-${props.stageName}-redis`,
    });

    this.redisGroupId = `janus-${props.stageName}-redis`;
    this.redis = new elasticache.CfnReplicationGroup(this, "Redis", {
      replicationGroupId: this.redisGroupId,
      replicationGroupDescription: `JANUS ${props.stageName} feed cache`,
      engine: "redis",
      engineVersion: "7.1",
      cacheNodeType: props.stageName === "prod" ? "cache.t4g.small" : "cache.t4g.micro",
      numCacheClusters: props.stageName === "prod" ? 2 : 1,
      automaticFailoverEnabled: props.stageName === "prod",
      multiAzEnabled: props.stageName === "prod",
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: false,
      cacheSubnetGroupName: redisSubnet.ref,
      securityGroupIds: [network.dataSg.securityGroupId],
    });
    this.redis.addResourceDependency(redisSubnet);

    this.userPool = new cognito.UserPool(this, "Users", {
      userPoolName: `janus-${props.stageName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      mfa: cognito.Mfa.OPTIONAL,
      passwordPolicy: { minLength: 12, requireDigits: true, requireSymbols: true, requireUppercase: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: props.deletionProtection,
      removalPolicy: props.deletionProtection ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    this.userPoolClient = this.userPool.addClient("App", {
      authFlows: { userSrp: true, userPassword: false },
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          "janus://auth",
          `https://app.${props.stageName === "prod" ? "" : "staging."}janus.app/api/auth/callback`,
        ],
      },
    });
    this.userPool.addDomain("HostedUi", {
      cognitoDomain: { domainPrefix: `janus-${props.stageName}-${this.account.slice(-6)}` },
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "VaultBucket", { value: this.vault.bucketName });
    new cdk.CfnOutput(this, "MediaDomain", { value: this.mediaDomain });
  }
}
