import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { appConfig } from "./config";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { value: string; exp: number }>();

  constructor() {
    if (appConfig.redisUrl) {
      this.redis = new Redis(appConfig.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
        // Fail fast instead of hanging every request when Redis stops answering
        // (e.g. the Docker VM froze with the TCP socket still open).
        connectTimeout: 3000,
        commandTimeout: 1500,
        keepAlive: 10_000,
      });
      this.redis.on("error", (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });
      void this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Redis unavailable, using memory cache: ${err.message}`);
      });
    } else {
      this.redis = null;
      this.logger.warn("REDIS_URL empty — in-memory cache only");
    }
  }

  async ping(): Promise<boolean> {
    if (this.redis?.status === "ready") {
      try {
        return (await this.redis.ping()) === "PONG";
      } catch {
        return false;
      }
    }
    return this.redis === null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit();
  }

  async get(key: string): Promise<string | null> {
    if (this.redis?.status === "ready") return this.redis.get(key);
    const hit = this.memory.get(key);
    if (!hit) return null;
    if (hit.exp < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSec: number): Promise<void> {
    if (this.redis?.status === "ready") {
      await this.redis.set(key, value, "EX", ttlSec);
      return;
    }
    this.memory.set(key, { value, exp: Date.now() + ttlSec * 1000 });
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (this.redis?.status === "ready") {
      await this.redis.del(...keys);
      return;
    }
    for (const key of keys) this.memory.delete(key);
  }

  async incr(key: string, ttlSec: number): Promise<number> {
    if (this.redis?.status === "ready") {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, ttlSec);
      return count;
    }
    const current = Number((await this.get(key)) ?? "0") + 1;
    const ttl = current === 1 ? ttlSec : Math.max(1, Math.ceil(((this.memory.get(key)?.exp ?? Date.now()) - Date.now()) / 1000));
    await this.set(key, String(current), ttl);
    return current;
  }

  async setNx(key: string, value: string, ttlSec: number): Promise<boolean> {
    if (this.redis?.status === "ready") {
      const res = await this.redis.set(key, value, "EX", ttlSec, "NX");
      return res === "OK";
    }
    if (this.memory.has(key) && (this.memory.get(key)?.exp ?? 0) > Date.now()) return false;
    await this.set(key, value, ttlSec);
    return true;
  }
}
