import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { ActivityService } from "./activity.service";

@Controller("admin/security")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSecurityAlertsController {
  constructor(private readonly activityService: ActivityService) {}

  @Get("alerts")
  async getSecurityAlerts(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("tzOffsetMinutes") tzOffsetMinutes?: string,
    @Query("search") search?: string,
    @Query("severity") severity?: string,
    @Query("incidentType") incidentType?: string,
    @Query("actionTaken") actionTaken?: string,
    @Query("endpointFamily") endpointFamily?: string,
    @Query("source") source?: string,
    @Query("breakLimit") breakLimit?: string,
    @Query("breakOffset") breakOffset?: string,
    @Query("rateLimitLimit") rateLimitLimit?: string,
    @Query("rateLimitOffset") rateLimitOffset?: string,
  ) {
    return this.activityService.getSecurityAlerts({
      from,
      to,
      tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
      search,
      severity,
      incidentType,
      actionTaken,
      endpointFamily,
      source,
      breakLimit: breakLimit ? Number(breakLimit) : undefined,
      breakOffset: breakOffset ? Number(breakOffset) : undefined,
      rateLimitLimit: rateLimitLimit ? Number(rateLimitLimit) : undefined,
      rateLimitOffset: rateLimitOffset ? Number(rateLimitOffset) : undefined,
    });
  }

  @Get("investigation")
  async getSecurityInvestigation(
    @Query("userId") userId?: string,
    @Query("ip") ip?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("tzOffsetMinutes") tzOffsetMinutes?: string,
    @Query("incidentType") incidentType?: string,
    @Query("incidentLimit") incidentLimit?: string,
    @Query("incidentOffset") incidentOffset?: string,
    @Query("rateLimitLimit") rateLimitLimit?: string,
    @Query("rateLimitOffset") rateLimitOffset?: string,
  ) {
    return this.activityService.getSecurityInvestigation({
      userId: userId ? Number(userId) : undefined,
      ip,
      from,
      to,
      tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
      incidentType,
      incidentLimit: incidentLimit ? Number(incidentLimit) : undefined,
      incidentOffset: incidentOffset ? Number(incidentOffset) : undefined,
      rateLimitLimit: rateLimitLimit ? Number(rateLimitLimit) : undefined,
      rateLimitOffset: rateLimitOffset ? Number(rateLimitOffset) : undefined,
    });
  }
}
