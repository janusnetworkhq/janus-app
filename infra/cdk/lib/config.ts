export type JanusStageName = "staging" | "prod";

export type JanusStageProps = {
  stageName: JanusStageName;
  env: { account: string; region: string };
  natGateways: number;
  apiDesiredCount: number;
  workerDesiredCount: number;
  apiCpu: number;
  apiMemory: number;
  auroraMinAcu: number;
  auroraMaxAcu: number;
  backupDays: number;
  deletionProtection: boolean;
  domainName?: string;
  imageTag: string;
};

export function stagingProps(account: string): JanusStageProps {
  return {
    stageName: "staging",
    env: { account, region: "ap-south-1" },
    natGateways: 1,
    apiDesiredCount: 1,
    workerDesiredCount: 1,
    apiCpu: 512,
    apiMemory: 1024,
    auroraMinAcu: 0.5,
    auroraMaxAcu: 2,
    backupDays: 7,
    deletionProtection: false,
    domainName: process.env.JANUS_STAGING_DOMAIN,
    imageTag: process.env.IMAGE_TAG ?? "staging",
  };
}

export function prodProps(account: string): JanusStageProps {
  return {
    stageName: "prod",
    env: { account, region: "ap-south-1" },
    natGateways: 2,
    apiDesiredCount: 2,
    workerDesiredCount: 1,
    apiCpu: 1024,
    apiMemory: 2048,
    auroraMinAcu: 0.5,
    auroraMaxAcu: 4,
    backupDays: 7,
    deletionProtection: true,
    domainName: process.env.JANUS_PROD_DOMAIN,
    imageTag: process.env.IMAGE_TAG ?? "prod",
  };
}
