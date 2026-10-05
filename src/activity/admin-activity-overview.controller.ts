import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { ActivityService } from "./activity.service";

@Controller("admin/activity")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminActivityOverviewController {
  constructor(private readonly activityService: ActivityService) {}

  @Get("overview")
  async getOverview(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("tzOffsetMinutes") tzOffsetMinutes?: string,
    @Query("feature") feature?: string,
  ) {
    return this.activityService.getGlobalOverview({
      from,
      to,
      tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
      feature: feature || undefined,
    });
  }
}
