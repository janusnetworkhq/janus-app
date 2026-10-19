import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PROFILE_KEY, ROLES_KEY } from "./auth.decorators";
import { AuthedUser } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiresProfile = this.reflector.getAllAndOverride<boolean>(PROFILE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<{ user?: AuthedUser }>().user;
    if (!user) return true;

    if (requiresProfile && !user.profileComplete) {
      throw ApiError.forbidden("PROFILE_INCOMPLETE", "Finish onboarding first");
    }
    if (!roles || roles.length === 0) return true;
    if (user.role === UserRole.PLATFORM_ADMIN) return true;
    if (!user.role || !roles.includes(user.role)) {
      throw ApiError.forbidden("FORBIDDEN", "Insufficient role");
    }
    return true;
  }
}
