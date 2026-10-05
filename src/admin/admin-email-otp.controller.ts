import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminGateGuard } from './admin-gate.guard';
import { AdminEmailOtpService } from './admin-email-otp.service';

@ApiTags('Admin - Email OTP')
@Controller('admin/email-otp')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminEmailOtpController {
  constructor(private readonly service: AdminEmailOtpService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get OTP email usage stats and current settings' })
  getStats() {
    return this.service.getStats();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update OTP thresholds and feature flag' })
  updateSettings(
    @Body() body: {
      thresholdMedium?: number;
      thresholdHigh?: number;
      thresholdHighest?: number;
      enabled?: boolean;
    },
    @Request() req,
  ) {
    return this.service.updateSettings(body, req.user.email || req.user.id?.toString());
  }
}
