import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { FastifyRequest } from "fastify";
import { CurrentUser, RequiresProfile, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { VaultService } from "./vault.service";

@ApiTags("vault")
@ApiBearerAuth()
@RequiresProfile()
@Roles(UserRole.RECRUITER)
@Controller("v1/vault")
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get("students/:id")
  list(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.vault.listStudentVault(user, id);
  }

  @Post("assets/:id/playback")
  playback(@CurrentUser() user: AuthedUser, @Param("id") id: string, @Req() req: FastifyRequest) {
    return this.vault.playback(user, id, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }
}
