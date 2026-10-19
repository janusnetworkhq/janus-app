import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/auth.decorators";
import { appConfig } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get("health")
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "janus-api" };
  }

  @Public()
  @Get("v1/health")
  live() {
    return { ok: true };
  }

  /** ALB / ECS target-group probe: Postgres + Redis. */
  @Public()
  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const redis = await this.redis.ping();
    if (appConfig.isProd && !redis) {
      throw new ServiceUnavailableException({
        error: { code: "NOT_READY", message: "Redis is not reachable", requestId: "ready" },
      });
    }
    return { ok: true, redis, postgres: true };
  }
}
