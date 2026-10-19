import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { NdaController } from "./nda.controller";
import { NdaService } from "./nda.service";

@Module({
  imports: [CommonModule],
  controllers: [NdaController],
  providers: [NdaService],
  exports: [NdaService],
})
export class NdaModule {}
