import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { NotificationService } from "./notification.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [CommonModule],
  controllers: [NotificationsController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
