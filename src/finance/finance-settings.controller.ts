import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { FinanceSettingsService } from "./finance-settings.service";
import { AdminHistoryService } from "../admin/admin-history.service";

@ApiTags("Admin - Finance Settings")
@Controller("admin/finance")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class FinanceSettingsController {
  constructor(
    private readonly financeSettingsService: FinanceSettingsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get("settings")
  @ApiOperation({ summary: "Get finance settings" })
  async getSettings() {
    const data = await this.financeSettingsService.getSettings();
    return { success: true, data };
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update master currency / conversion rate" })
  async updateSettings(
    @Request() req,
    @Body() body: { masterCurrency?: string; usdToEgpRate?: number },
  ) {
    const before = await this.financeSettingsService.getSettings();
    const data = await this.financeSettingsService.updateSettings(
      body.masterCurrency,
      body.usdToEgpRate !== undefined ? Number(body.usdToEgpRate) : undefined,
      Number(req.user.id),
    );
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "UPDATE_FINANCE_SETTINGS",
      "FinanceSetting",
      data.id.toString(),
      { before: { masterCurrency: before.masterCurrency, usdToEgpRate: before.usdToEgpRate }, after: body },
      "Finance Settings",
    );
    return { success: true, data };
  }
}
