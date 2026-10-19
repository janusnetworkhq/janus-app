import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UploadKind, UserRole, VaultAssetKind } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CurrentUser, RequiresProfile, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { MediaService } from "./media.service";

class CreateUploadDto {
  @IsEnum(UploadKind)
  kind!: UploadKind;

  @IsString()
  @MaxLength(128)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  byteSize!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsEnum(VaultAssetKind)
  vaultKind?: VaultAssetKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;
}

class CompleteUploadDto {
  @IsOptional()
  @IsEnum(VaultAssetKind)
  vaultKind?: VaultAssetKind;

  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsString()
  videoId?: string;
}

@ApiTags("media")
@ApiBearerAuth()
@Controller("v1")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @RequiresProfile()
  @Post("uploads")
  create(@CurrentUser() user: AuthedUser, @Body() body: CreateUploadDto) {
    return this.media.createUpload(user, body);
  }

  @RequiresProfile()
  @Post("uploads/:id/complete")
  complete(
    @CurrentUser() user: AuthedUser,
    @Param("id") id: string,
    @Body() body: CompleteUploadDto,
  ) {
    return this.media.complete(user, id, body);
  }

  @Get("videos/:id")
  get(@Param("id") id: string) {
    return this.media.getVideo(id);
  }

  @Roles(UserRole.STUDENT)
  @Delete("videos/:id")
  remove(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.media.deleteVideo(user, id);
  }
}
