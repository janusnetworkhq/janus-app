import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { appConfig } from "./config";

export type HeadResult = { contentLength: number; contentType?: string; etag?: string };

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly memory = new Map<string, { bytes: Buffer; type: string }>();

  constructor() {
    if (appConfig.mediaDriver === "s3") {
      this.s3 = new S3Client({
        region: appConfig.awsRegion,
        endpoint: appConfig.awsEndpoint,
        forcePathStyle: Boolean(appConfig.awsEndpoint),
        // Presigned PUTs from mobile clients cannot compute the body checksum the SDK
        // would otherwise bake into the URL (it signs the CRC32 of an empty body).
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: appConfig.awsEndpoint
          ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test" }
          : undefined,
      });
    } else {
      this.s3 = null;
    }
  }

  async presignPut(bucket: string, key: string, contentType: string, byteSize: number): Promise<string> {
    if (!this.s3) {
      return `noop://upload/${bucket}/${key}?size=${byteSize}&type=${encodeURIComponent(contentType)}`;
    }
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
      }),
      { expiresIn: appConfig.limits.presignTtlSec },
    );
  }

  async head(bucket: string, key: string): Promise<HeadResult> {
    if (!this.s3) {
      const obj = this.memory.get(`${bucket}/${key}`);
      return {
        contentLength: obj?.bytes.length ?? 0,
        contentType: obj?.type,
        etag: '"noop"',
      };
    }
    const res = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType,
      etag: res.ETag,
    };
  }

  async put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.s3) {
      this.memory.set(`${bucket}/${key}`, { bytes: body, type: contentType });
      return;
    }
    await this.s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    if (!this.s3) {
      const obj = this.memory.get(`${bucket}/${key}`);
      if (!obj) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
      return obj.bytes;
    }
    const res = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object ${bucket}/${key}`);
    return Buffer.from(bytes);
  }

  async signedGet(bucket: string, key: string, ttlSec: number): Promise<string> {
    if (!this.s3) {
      return `noop://get/${bucket}/${key}`;
    }
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSec },
    );
  }

  publicUrl(key: string): string {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }
    return `${appConfig.mediaPublicBase.replace(/\/$/, "")}/${key}`;
  }
}
