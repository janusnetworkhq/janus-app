import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { MediaModule } from "../media/media.module";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";

@Module({
  imports: [CommonModule, MediaModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
