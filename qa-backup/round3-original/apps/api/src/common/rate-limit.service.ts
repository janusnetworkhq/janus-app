import { Injectable } from "@nestjs/common";
import { ApiError } from "./api-error";
import { appConfig } from "./config";
import { RedisService } from "./redis.service";

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSec: number): Promise<void> {
    const count = await this.redis.incr(`rl:${key}`, windowSec);
    if (count > limit) {
      throw ApiError.tooMany(`Limit ${limit} per ${windowSec}s exceeded`);
    }
  }

  async hitGlobal(actor: string): Promise<void> {
    await this.consume(`g:${actor}`, appConfig.limits.globalPerMin, 60);
  }

  async hitNda(userId: string): Promise<void> {
    await this.consume(`nda:${userId}`, appConfig.limits.ndaPerDay, 86400);
  }

  async hitVault(userId: string): Promise<void> {
    await this.consume(`vault:${userId}`, appConfig.limits.vaultPerHour, 3600);
  }

  async hitUpload(userId: string): Promise<void> {
    await this.consume(`up:${userId}`, appConfig.limits.uploadPerHour, 3600);
  }

  async hitLike(userId: string): Promise<void> {
    await this.consume(`like:${userId}`, appConfig.limits.likePerMin, 60);
  }
}
