import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { IdentityService } from "./identity.service";

class UpsertProfileDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  handle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  university?: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2040)
  graduationYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  orgName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orgSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

@ApiTags("identity")
@ApiBearerAuth()
@Controller("v1")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("me")
  me(@CurrentUser() user: AuthedUser) {
    return this.identity.getMe(user.id);
  }

  @Post("me/profile")
  profile(@CurrentUser() user: AuthedUser, @Body() body: UpsertProfileDto) {
    return this.identity.upsertProfile(user, body);
  }

  @Get("users/:id")
  card(@CurrentUser() viewer: AuthedUser, @Param("id") id: string) {
    return this.identity.publicCard(id, viewer.id);
  }

  @Roles(UserRole.RECRUITER, UserRole.PLATFORM_ADMIN)
  @Get("orgs/:id")
  org(@Param("id") id: string) {
    return this.identity.getOrg(id);
  }
}
