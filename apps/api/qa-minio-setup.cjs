const { S3Client, CreateBucketCommand, PutBucketPolicyCommand, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: "ap-south-1", endpoint: "http://localhost:4566", forcePathStyle: true, credentials: { accessKeyId: "janusminio", secretAccessKey: "janusminio123" } });
(async () => {
  for (const b of ["janus-uploads", "janus-public-media", "janus-vault"]) {
    try { await s3.send(new CreateBucketCommand({ Bucket: b })); console.log("created", b); } catch (e) { console.log(b, e.name); }
  }
  await s3.send(new PutBucketPolicyCommand({ Bucket: "janus-public-media", Policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::janus-public-media/*"] }] }) }));
  console.log("policy ok");
})();
