import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { CommonModule } from "./common/common.module";
import { FeedModule } from "./feed/feed.module";
import { HealthController } from "./health/health.controller";
import { IdentityModule } from "./identity/identity.module";
import { MediaModule } from "./media/media.module";
import { NdaModule } from "./nda/nda.module";
import { VaultModule } from "./vault/vault.module";
import { WorkerHost } from "./workers/worker.host";

@Global()
@Module({
  imports: [
    CommonModule,
    IdentityModule,
    AuthModule,
    MediaModule,
    FeedModule,
    NdaModule,
    VaultModule,
    AdminModule,
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [
    WorkerHost,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
