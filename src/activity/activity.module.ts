import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserActivityLog } from "../entities/user-activity-log.entity";
import { RequestRateLimitAlert } from "../entities/request-rate-limit-alert.entity";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { AdminUserActivityController } from "./admin-user-activity.controller";
import { AdminActivityOverviewController } from "./admin-activity-overview.controller";
import { AdminSecurityAlertsController } from "./admin-security-alerts.controller";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings/settings.module";
import { User } from "../entities/user.entity";
import { SecurityIncident } from "../entities/security-incident.entity";
import { SecurityActorState } from "../entities/security-actor-state.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserActivityLog,
      RequestRateLimitAlert,
      User,
      SecurityIncident,
      SecurityActorState,
    ]),
    AdminModule,
    SettingsModule,
  ],
  controllers: [
    ActivityController,
    AdminUserActivityController,
    AdminActivityOverviewController,
    AdminSecurityAlertsController,
  ],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
