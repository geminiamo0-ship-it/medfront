import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "./admin-gate.guard";
import { UserRole } from "../entities/user.entity";
import { AdminNotificationsService } from "./admin-notifications.service";

@ApiTags("Admin - Notifications")
@Controller("admin/notifications")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(
    private readonly notificationsService: AdminNotificationsService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Admin access required");
    }
  }

  @Get()
  @ApiOperation({ summary: "Get admin notifications" })
  @ApiResponse({ status: 200, description: "Notifications retrieved" })
  async getNotifications(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("since") since?: string,
  ) {
    this.checkAdminRole(req.user);
    const parsedLimit = Math.max(1, Number(limit) || 10);
    const parsedOffset = Math.max(0, Number(offset) || 0);
    const parsedUnread = unreadOnly === "true";
    const parsedSince =
      since && !Number.isNaN(new Date(since).getTime())
        ? new Date(since)
        : undefined;

    return this.notificationsService.getAdminNotifications({
      adminId: Number(req.user.id),
      limit: parsedLimit,
      offset: parsedOffset,
      unreadOnly: parsedUnread,
      since: parsedSince,
    });
  }

  @Post("mark-read")
  @ApiOperation({ summary: "Mark admin notifications as read" })
  @ApiResponse({ status: 200, description: "Notifications updated" })
  async markRead(
    @Request() req,
    @Body() body: { ids?: number[]; all?: boolean },
  ) {
    this.checkAdminRole(req.user);
    return this.notificationsService.markAdminNotificationsRead({
      adminId: Number(req.user.id),
      ids: body?.ids,
      all: body?.all === true,
    });
  }
}
