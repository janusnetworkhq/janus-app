import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import { appConfig } from "./config";

export type CloudinaryResourceType = "video" | "image" | "raw";
export type CloudinaryTicket = { uploadUrl: string; publicId: string; resourceType: CloudinaryResourceType; formFields: Record<string, string> };
export type CloudinaryResource = { bytes: number; format?: string; width?: number; height?: number; durationMs?: number; etag?: string };

/** Pure helpers (unit-tested without network): resource typing + delivery URLs. */
export function cloudinaryResourceType(input: { kind?: string; contentType?: string }): CloudinaryResourceType {
  if (input.kind === "FEED_VIDEO" || input.kind === "VAULT_VIDEO") return "video";
  if (input.contentType?.startsWith("video/")) return "video";
  if (input.kind === "AVATAR" || input.kind === "BANNER" || input.contentType?.startsWith("image/")) return "image";
  return "raw";
}
export function cloudinaryHlsUrl(cloud: string, publicId: string, profile: string): string {
  return `https://res.cloudinary.com/${cloud}/video/upload/sp_${profile}/${publicId}.m3u8`;
}
export function cloudinaryPosterUrl(cloud: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloud}/video/upload/so_1,f_jpg/${publicId}.jpg`;
}

export type HeadResult = { contentLength: number; contentType?: string; etag?: string };

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly memory = new Map<string, { bytes: Buffer; type: string }>();

  constructor() {
    if (appConfig.mediaDriver === "cloudinary") {
      cloudinary.config({
        cloud_name: appConfig.cloudinaryCloudName,
        api_key: appConfig.cloudinaryApiKey,
        api_secret: appConfig.cloudinaryApiSecret,
        secure: true,
      });
      this.s3 = null;
      return;
    }
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

  get isCloudinary(): boolean {
    return appConfig.mediaDriver === "cloudinary";
  }

  /** Signed direct-upload ticket (multipart POST) for Cloudinary. Vault kinds are authenticated. */
  createCloudinaryTicket(publicId: string, resourceType: CloudinaryResourceType, vault: boolean): CloudinaryTicket {
    const timestamp = Math.floor(Date.now() / 1000);
    const type = vault ? "authenticated" : "upload";
    const params: Record<string, string | number> = { public_id: publicId, timestamp, type };
    // No eager transformation: Cloudinary rejects `sp_*/f_hls` as eager ("Invalid format: hls").
    // Adaptive HLS is derived on-the-fly from the delivery URL (sp_<profile>/<id>.m3u8), and the
    // poster from so_1,f_jpg - neither needs eager generation at upload time.
    const signature = cloudinary.utils.api_sign_request(params, appConfig.cloudinaryApiSecret);
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${appConfig.cloudinaryCloudName}/${resourceType}/upload`,
      publicId,
      resourceType,
      formFields: {
        api_key: appConfig.cloudinaryApiKey,
        timestamp: String(timestamp),
        signature,
        public_id: publicId,
        type,
      },
    };
  }

  async cloudinaryResource(publicId: string, resourceType: CloudinaryResourceType, vault: boolean): Promise<CloudinaryResource> {
    const res = (await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: vault ? "authenticated" : "upload",
    })) as { bytes?: number; format?: string; width?: number; height?: number; duration?: number; etag?: string };
    return {
      bytes: res.bytes ?? 0,
      format: res.format,
      width: res.width,
      height: res.height,
      durationMs: res.duration ? Math.round(res.duration * 1000) : undefined,
      etag: res.etag,
    };
  }

  cloudinarySignedUrl(publicId: string, resourceType: CloudinaryResourceType, ttlSec: number): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + ttlSec,
      // Raw public_ids already carry their extension (e.g. "x.pdf"); passing `format` too
      // would yield "x.pdf.pdf" and a Cloudinary 404.
    });
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
    if (this.isCloudinary) {
      const rt = cloudinaryResourceType({ contentType: bucket });
      void rt;
      throw new Error("Use cloudinaryResource() for Cloudinary head checks");
    }
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
    if (this.isCloudinary) {
      const resourceType = cloudinaryResourceType({ contentType });
      const publicId = key.replace(/\.[a-z0-9]+$/i, "");
      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: resourceType, type: bucket === appConfig.s3VaultBucket ? "authenticated" : "upload", overwrite: true },
          (err) => (err ? reject(err) : resolve()),
        );
        stream.end(body);
      });
      return;
    }
    if (!this.s3) {
      this.memory.set(`${bucket}/${key}`, { bytes: body, type: contentType });
      return;
    }
    await this.s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    if (this.isCloudinary) {
      const url = this.cloudinarySignedUrl(key, cloudinaryResourceType({ contentType: bucket }), 600);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cloudinary fetch failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
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

  async signedGet(bucket: string, key: string, ttlSec: number, resourceTypeHint?: CloudinaryResourceType): Promise<string> {
    if (this.isCloudinary) {
      return this.cloudinarySignedUrl(key, resourceTypeHint ?? "raw", ttlSec);
    }
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
    if (this.isCloudinary) {
      return cloudinary.url(key.replace(/\.[a-z0-9]+$/i, ""), { resource_type: "image", secure: true });
    }
    return `${appConfig.mediaPublicBase.replace(/\/$/, "")}/${key}`;
  }
}
