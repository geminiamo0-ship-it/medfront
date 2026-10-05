import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminGateService } from './admin-gate.service';

@ApiTags('Admin - Gate')
@ApiBearerAuth()
@Controller('admin/gate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminGateController {
  constructor(private readonly adminGateService: AdminGateService) {}

  @Post('verify')
  @ApiOperation({ summary: 'Verify admin gate password' })
  async verifyGate(@Request() req, @Body('password') password: string) {
    const adminId = Number(req.user?.id || req.user?.userId);
    return this.adminGateService.verifyPassword(password, adminId);
  }
}
