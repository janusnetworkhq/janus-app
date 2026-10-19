import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { MediaController } from "./media.controller";
import { MediaPipelineService } from "./media-pipeline.service";
import { MediaService } from "./media.service";

@Module({
  imports: [CommonModule],
  controllers: [MediaController],
  providers: [MediaService, MediaPipelineService],
  exports: [MediaService, MediaPipelineService],
})
export class MediaModule {}
