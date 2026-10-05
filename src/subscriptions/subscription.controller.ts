import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGateGuard } from '../admin/admin-gate.guard';
import { SubscriptionService } from './subscription.service';
import { UserRole } from '../entities/user.entity';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current user subscription status' })
  @ApiResponse({
    status: 200,
    description: 'Subscription status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getStatus(@Request() req) {
    // ✅ Pass full user object instead of just ID
    return this.subscriptionService.getSubscriptionStatus(req.user);
  }

  @Post('check-access')
  @ApiOperation({ summary: 'Check if user has access to a specific step' })
  @ApiResponse({
    status: 200,
    description: 'Access check completed',
  })
  async checkAccess(@Request() req, @Body() body: { stepNumber: number }) {
    // ✅ Pass full user object instead of just ID
    const result = await this.subscriptionService.hasAccessToStep(
      req.user,
      body.stepNumber,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('check-qbank-access')
  @ApiOperation({ summary: 'Check if user has access to a specific question bank' })
  @ApiResponse({
    status: 200,
    description: 'Question bank access check completed',
  })
  async checkQBankAccess(@Request() req, @Body() body: { questionBankCode?: string; questionBankId?: number }) {
    const identifier = body.questionBankId || body.questionBankCode;
    const result = await this.subscriptionService.hasAccessToQuestionBank(
      req.user,
      identifier,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription (keeps access until expiry)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async cancelSubscription(@Request() req) {
    return this.subscriptionService.cancelSubscription(req.user.id);
  }

  @Post('refresh-cache')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refresh cached user subscription status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cache cleared successfully',
  })
  async refreshSubscriptionCache(
    @Request() req,
    @Body() body: { userId: number },
  ) {
    // Check if user is admin
    if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    await this.subscriptionService.refreshUserCache(Number(body.userId));
    return {
      success: true,
      message: 'User subscription cache cleared',
    };
  }

  @Post('admin/grant')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Grant subscription to a user (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription granted successfully',
  })
  async grantSubscription(
    @Request() req,
    @Body() body: { userId: number; plan: string; durationMonths: number },
  ) {
    // Check if user is admin
    if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return this.subscriptionService.activateSubscription(
      body.userId,
      body.plan,
      body.durationMonths,
    );
  }
}
