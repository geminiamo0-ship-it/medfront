import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { ActivityService } from "./activity.service";

@Controller("admin/user-activity")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUserActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getTimeline(
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("feature") feature?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!userId) {
      throw new BadRequestException("userId is required");
    }
    return this.activityService.getTimeline({
      userId: Number(userId),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      feature,
      action,
      from,
      to,
    });
  }

  @Get("summary")
  async getSummary(
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!userId) {
      throw new BadRequestException("userId is required");
    }
    return this.activityService.getSummary({
      userId: Number(userId),
      from,
      to,
    });
  }

  @Get("alerts")
  async getDailyAlerts(
    @Query("date") date?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("tzOffsetMinutes") tzOffsetMinutes?: string,
  ) {
    return this.activityService.getDailyAlerts({
      date,
      from,
      to,
      tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
    });
  }
}
