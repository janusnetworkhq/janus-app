import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

@Module({
  imports: [CommonModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
