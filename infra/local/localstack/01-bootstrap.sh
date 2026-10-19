#!/usr/bin/env bash
set -euo pipefail

echo "[janus] creating S3 buckets"
awslocal s3 mb s3://janus-uploads || true
awslocal s3 mb s3://janus-public-media || true
awslocal s3 mb s3://janus-vault || true

awslocal s3api put-bucket-versioning --bucket janus-vault --versioning-configuration Status=Enabled
awslocal s3api put-public-access-block --bucket janus-vault --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
awslocal s3api put-public-access-block --bucket janus-uploads --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "[janus] creating SQS queues + DLQs"
for name in media-transcode media-callbacks nda-lifecycle notify-send; do
  awslocal sqs create-queue --queue-name "${name}-dlq" >/dev/null
  dlq_arn="arn:aws:sqs:ap-south-1:000000000000:${name}-dlq"
  awslocal sqs create-queue --queue-name "${name}" --attributes "{
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${dlq_arn}\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\",
    \"VisibilityTimeout\": \"120\",
    \"MessageRetentionPeriod\": \"1209600\"
  }" >/dev/null
done

echo "[janus] localstack bootstrap complete"
