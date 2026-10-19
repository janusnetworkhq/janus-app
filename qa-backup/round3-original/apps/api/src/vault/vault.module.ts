import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { VaultController } from "./vault.controller";
import { VaultService } from "./vault.service";

@Module({
  imports: [CommonModule],
  controllers: [VaultController],
  providers: [VaultService],
})
export class VaultModule {}
