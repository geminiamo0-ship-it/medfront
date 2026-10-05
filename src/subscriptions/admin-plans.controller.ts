import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGateGuard } from '../admin/admin-gate.guard';
import { PricingPlansService } from './pricing-plans.service';
import { CreatePricingPlanDto, UpdatePricingPlanDto } from './dto/pricing-plan.dto';
import { UserRole } from '../entities/user.entity';
import { AdminHistoryService } from '../admin/admin-history.service';

@ApiTags('Admin - Plans')
@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminPlansController {
  constructor(
    private readonly pricingPlansService: PricingPlansService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans (Admin only)' })
  @ApiResponse({ status: 200, description: 'Plans retrieved' })
  async getAllPlans(@Request() req) {
    this.checkAdminRole(req.user);
    const plans = await this.pricingPlansService.getAllPlans();
    return { success: true, data: plans };
  }

  @Post()
  @ApiOperation({ summary: 'Create a pricing plan (Admin only)' })
  @ApiResponse({ status: 403, description: 'Plan creation disabled' })
  async createPlan(@Request() req, @Body() _body: CreatePricingPlanDto) {
    this.checkAdminRole(req.user);
    throw new ForbiddenException('Plan creation is disabled');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pricing plan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  async updatePlan(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePricingPlanDto,
  ) {
    this.checkAdminRole(req.user);
    const plan = await this.pricingPlansService.updatePlan(id, body);

    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'UPDATE_PLAN',
      'PricingPlan',
      id.toString(),
      plan,
      'Payments',
    );

    return { success: true, data: plan };
  }
}
