import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { appConfig } from "../common/config";
import { CommonModule } from "../common/common.module";
import { IdentityModule } from "../identity/identity.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { DevAuthController } from "./dev-auth.controller";
import { JwtVerifier } from "./jwt.verifier";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [CommonModule, IdentityModule],
  controllers: [
    AuthController,
    ...(appConfig.authMode === "local" ? [DevAuthController] : []),
  ],
  providers: [
    JwtVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
