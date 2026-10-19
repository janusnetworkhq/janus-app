import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { FastifyRequest } from "fastify";
import type { AuthedUser } from "./auth.types";

export const IS_PUBLIC = "isPublic";
export const ROLES_KEY = "roles";
export const PROFILE_KEY = "requiresProfile";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
export const RequiresProfile = () => SetMetadata(PROFILE_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthedUser => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthedUser }>();
  return req.user;
});
