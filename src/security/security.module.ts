import { Module, forwardRef } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityIncident } from "../entities/security-incident.entity";
import { SecurityActorState } from "../entities/security-actor-state.entity";
import { UserQuotaCounter } from "../entities/user-quota-counter.entity";
import { BlockedIp } from "../entities/blocked-ip.entity";
import { BlockedIpAttempt } from "../entities/blocked-ip-attempt.entity";
import { User } from "../entities/user.entity";
import { Test } from "../entities/test.entity";
import { SettingsModule } from "../settings/settings.module";
import { SecurityPolicyService } from "./security-policy.service";
import { SecurityService } from "./security.service";
import { ContentSecurityGuard } from "./content-security.guard";
import { SecurityWatermarkService } from "./security-watermark.service";
import { TelegramService } from "../integrations/telegram.service";
import { SecurityAdminController } from "./security.controller";
import { AdminModule } from "../admin/admin.module";
import { BlockedIpService } from "./ip-block.service";
import { SecurityIpGuard } from "./security-ip.guard";
import { SecurityQuotaService } from "./security-quota.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityIncident,
      SecurityActorState,
      UserQuotaCounter,
      BlockedIp,
      BlockedIpAttempt,
      User,
      Test,
    ]),
    SettingsModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [SecurityAdminController],
  providers: [
    SecurityPolicyService,
    SecurityService,
    ContentSecurityGuard,
    SecurityWatermarkService,
    BlockedIpService,
    SecurityQuotaService,
    SecurityIpGuard,
    TelegramService,
    {
      provide: APP_GUARD,
      useClass: SecurityIpGuard,
    },
  ],
  exports: [
    SecurityPolicyService,
    SecurityService,
    ContentSecurityGuard,
    SecurityWatermarkService,
    BlockedIpService,
    SecurityQuotaService,
    TelegramService,
  ],
})
export class SecurityModule {}
