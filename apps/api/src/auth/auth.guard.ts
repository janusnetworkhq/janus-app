import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { ApiError } from "../common/api-error";
import { RateLimitService } from "../common/rate-limit.service";
import { RedisService } from "../common/redis.service";
import { IdentityService } from "../identity/identity.service";
import { IS_PUBLIC } from "./auth.decorators";
import { AuthedUser } from "./auth.types";
import { JwtVerifier } from "./jwt.verifier";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtVerifier,
    private readonly identity: IdentityService,
    private readonly redis: RedisService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized();
    }
    const token = header.slice(7);
    const claims = await this.jwt.verify(token).catch(() => {
      throw ApiError.unauthorized("Invalid or expired token");
    });

    const cacheKey = `user:sub:${claims.sub}`;
    const cached = await this.redis.get(cacheKey);
    let user: AuthedUser;
    if (cached) {
      user = JSON.parse(cached) as AuthedUser;
    } else {
      user = await this.identity.upsertFromClaims(claims, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      await this.redis.set(cacheKey, JSON.stringify(user), 60);
    }

    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden(user.status, "Account is not active");
    }

    await this.rateLimit.hitGlobal(user.id);
    req.user = user;
    return true;
  }
}
