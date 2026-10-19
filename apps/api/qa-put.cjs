const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const s3 = new S3Client({ region: "ap-south-1", endpoint: "http://localhost:4566", forcePathStyle: true, credentials: { accessKeyId: "janusminio", secretAccessKey: "janusminio123" } });
const [bucket, key, file, type] = process.argv.slice(2);
s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.readFileSync(file), ContentType: type })).then(() => console.log("put", key));
