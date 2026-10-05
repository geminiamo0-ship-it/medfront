import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminGateGuard } from './admin-gate.guard';
import { AdminAiService } from './admin-ai.service';

@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAiController {
  constructor(private readonly adminAiService: AdminAiService) {}

  @Get('usage')
  async getAiUsage(@Query('date') date?: string) {
    const data = await this.adminAiService.getAiUsage(date);
    return {
      success: true,
      data,
    };
  }
}
