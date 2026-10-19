import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { ApiError } from "../common/api-error";
import { NotificationService } from "./notification.service";

class PushTokenDto {
  @IsString()
  @MaxLength(255)
  token!: string;

  @IsIn(["ios", "android", "web"])
  platform!: string;
}

class RemovePushTokenDto {
  @IsString()
  @MaxLength(255)
  token!: string;
}

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("v1/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query("cursor") cursor?: string) {
    return this.notifications.list(user.id, cursor);
  }

  @Post("read-all")
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthedUser) {
    return this.notifications.markRead(user.id);
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post("push-tokens")
  @HttpCode(200)
  register(@CurrentUser() user: AuthedUser, @Body() body: PushTokenDto) {
    if (!NotificationService.isExpoToken(body.token)) {
      throw ApiError.badRequest("PUSH_TOKEN", "Not an Expo push token");
    }
    return this.notifications.registerToken(user.id, body.token, body.platform);
  }

  @Delete("push-tokens")
  @HttpCode(200)
  unregister(@CurrentUser() user: AuthedUser, @Body() body: RemovePushTokenDto) {
    return this.notifications.unregisterToken(user.id, body.token);
  }
}
