import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser, RequiresProfile } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { FeedService } from "./feed.service";

class CommentDto {
  @IsString()
  @MaxLength(500)
  body!: string;
}

class ImpressionsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  videoIds!: string[];
}

@ApiTags("feed")
@ApiBearerAuth()
@RequiresProfile()
@Controller("v1")
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get("feed")
  feedTimeline(
    @CurrentUser() user: AuthedUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("university") university?: string,
  ) {
    return this.feed.timeline(user, cursor, limit ? Number(limit) : 10, university);
  }

  @Post("videos/:id/like")
  like(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.like(user, id);
  }

  @Delete("videos/:id/like")
  unlike(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.unlike(user, id);
  }

  @Post("videos/:id/comments")
  comment(@CurrentUser() user: AuthedUser, @Param("id") id: string, @Body() body: CommentDto) {
    return this.feed.comment(user, id, body.body);
  }

  @Get("videos/:id/comments")
  comments(@Param("id") id: string, @Query("cursor") cursor?: string) {
    return this.feed.listComments(id, cursor);
  }

  @Post("users/:id/follow")
  follow(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.follow(user, id);
  }

  @Delete("users/:id/follow")
  unfollow(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.unfollow(user, id);
  }

  @Post("videos/:id/bookmark")
  bookmark(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.bookmark(user, id);
  }

  @Delete("videos/:id/bookmark")
  unbookmark(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.feed.unbookmark(user, id);
  }

  @Get("me/bookmarks")
  bookmarks(@CurrentUser() user: AuthedUser) {
    return this.feed.myBookmarks(user);
  }

  @Post("impressions")
  impressions(@CurrentUser() user: AuthedUser, @Body() body: ImpressionsDto) {
    return this.feed.impressions(user, body.videoIds);
  }

  @Get("users/:id/videos")
  userVideos(@Param("id") id: string, @Query("cursor") cursor?: string) {
    return this.feed.userVideos(id, cursor);
  }
}
