import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import { FastifyRequest } from "fastify";
import { CurrentUser, RequiresProfile, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { NdaService } from "./nda.service";

class NdaRequestDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  videoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class DecideDto {
  // Keep the raw JSON value: implicit conversion would turn "false"/"no" into true.
  @Transform(({ obj }) => (obj as { accept?: unknown }).accept)
  @IsBoolean()
  accept!: boolean;
}

class SignDto {
  @IsString()
  @MaxLength(120)
  typedName!: string;

  @IsString()
  @MaxLength(64)
  acceptedHash!: string;

  /** Base64 PNG from the web signing pad. Optional: mobile keeps typed signing. */
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  signaturePngBase64?: string;
}

@ApiTags("nda")
@ApiBearerAuth()
@RequiresProfile()
@Controller("v1/nda")
export class NdaController {
  constructor(private readonly nda: NdaService) {}

  @Roles(UserRole.RECRUITER, UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Get("templates/default")
  template() {
    return this.nda.defaultTemplate();
  }

  @Roles(UserRole.RECRUITER, UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Post("requests")
  create(
    @CurrentUser() user: AuthedUser,
    @Body() body: NdaRequestDto,
    @Req() req: FastifyRequest,
  ) {
    return this.nda.request(user, body, headerKey(req));
  }

  @Roles(UserRole.STUDENT, UserRole.RECRUITER, UserRole.PLATFORM_ADMIN)
  @Get("inbox")
  inbox(@CurrentUser() user: AuthedUser) {
    return this.nda.inbox(user);
  }

  @Roles(UserRole.RECRUITER, UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Get("outbound")
  outbound(@CurrentUser() user: AuthedUser) {
    return this.nda.outbound(user);
  }

  @Roles(UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Post("requests/:id/decide")
  decide(@CurrentUser() user: AuthedUser, @Param("id") id: string, @Body() body: DecideDto) {
    return this.nda.decide(user, id, body.accept);
  }

  @Roles(UserRole.RECRUITER, UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Post("requests/:id/sign")
  sign(
    @CurrentUser() user: AuthedUser,
    @Param("id") id: string,
    @Body() body: SignDto,
    @Req() req: FastifyRequest,
  ) {
    return this.nda.sign(
      user,
      id,
      body,
      { ip: req.ip, userAgent: req.headers["user-agent"] },
      headerKey(req),
    );
  }

  @Roles(UserRole.STUDENT, UserRole.PLATFORM_ADMIN)
  @Post("grants/:id/revoke")
  revoke(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.nda.revoke(user, id);
  }
}

function headerKey(req: FastifyRequest): string | undefined {
  const raw = req.headers["idempotency-key"];
  return typeof raw === "string" ? raw : undefined;
}
