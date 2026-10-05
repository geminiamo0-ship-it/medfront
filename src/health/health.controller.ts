import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  UseGuards,
  ForbiddenException,
  Request,
} from "@nestjs/common";
import { HealthService } from "./health.service";
import { DatabaseMonitorService } from "./database-monitor.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly dbMonitor: DatabaseMonitorService,
  ) {}

  /**
   * Public endpoint — no auth required so external uptime monitors can reach it.
   * Returns 200 when ok/degraded, 503 when fully down.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    const result = await this.health.checkAll();
    if (result.status === "down") {
      throw new ServiceUnavailableException({ message: 'Service Unavailable', ...result });
    }
    return result;
  }

  /**
   * Admin-only — returns the current Postgres connection pool snapshot so
   * operators can spot saturation in real time without waiting for the
   * Telegram alert. Numbers mirror what DatabaseMonitorService uses for
   * alerting; see PoolSnapshot in database-monitor.service.ts.
   */
  @Get("pool")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPool(@Request() req: any) {
    if (
      req.user?.role !== UserRole.ADMIN &&
      req.user?.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException("Admin access required");
    }
    const snapshot = this.dbMonitor.getPoolSnapshot();
    return {
      ok: snapshot !== null,
      timestamp: new Date().toISOString(),
      pool: snapshot,
    };
  }
}
