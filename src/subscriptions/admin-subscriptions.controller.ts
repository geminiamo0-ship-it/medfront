import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGateGuard } from '../admin/admin-gate.guard';
import { UserRole } from '../entities/user.entity';
import { AdminHistoryService } from '../admin/admin-history.service';
import { AdminUserNotesService } from '../admin/admin-user-notes.service';
import { SubscriptionService } from './subscription.service';
import { UsersService } from '../users/users.service';

import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SubscriptionPlan } from '../entities/user.entity';

export class AdminUpdateSubscriptionDto {
  /** Target plan: "Free" | "Basic" | "Premium" */
  @IsIn(Object.values(SubscriptionPlan))
  plan: string;

  /**
   * Optional custom expiry date (ISO 8601 string).
   * When provided, this date is used directly (ignoring durationMonths).
   */
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  /**
   * Duration in months from now. Ignored when expiryDate is set.
   * 0 = lifetime (year 9999).
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMonths?: number;

  /** Admin-facing reason / note for the audit log */
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminRevokeSubscriptionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Admin - Subscriptions')
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminSubscriptionsController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usersService: UsersService,
    private readonly historyService: AdminHistoryService,
    private readonly notesService: AdminUserNotesService,
  ) {}

  // ─── List premium users ───────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List users with active subscriptions (Admin only)' })
  async getPremiumUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('plan') plan?: string,
  ) {
    const parsedLimit = Math.max(1, Number(limit) || 25);
    const parsedOffset = Math.max(0, Number(offset) || 0);

    // Reuse the existing admin getUsers endpoint with subscription filter
    return this.usersService.findAll(
      parsedLimit,
      parsedOffset,
      search,
      plan || 'Premium',  // default to Premium filter
      true,              // activeOnly = true for subscription list
    );
  }

  // ─── Update subscription ──────────────────────────────────────────────────

  @Patch('users/:id')
  @ApiOperation({ summary: 'Override a user subscription plan / expiry (Admin only)' })
  async updateSubscription(
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: AdminUpdateSubscriptionDto,
    @Request() req,
  ) {
    const result = await this.subscriptionService.adminUpdateSubscription(
      userId,
      body.plan,
      body.expiryDate,
      body.durationMonths,
    );

    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'ADMIN_UPDATE_SUBSCRIPTION',
      'User',
      userId.toString(),
      {
        plan: body.plan,
        expiryDate: body.expiryDate,
        durationMonths: body.durationMonths,
        reason: body.reason,
        result: result.message,
      },
      'Subscription Manager',
    );

    if (body.reason?.trim()) {
      const adminId = Number(req.user.id || req.user.userId || null);
      await this.notesService.createNote(
        userId,
        Number.isFinite(adminId) ? adminId : null,
        `Subscription Update: ${body.reason}`,
      ).catch(err => console.error('Failed to create subscription update note:', err));
    }

    return result;
  }

  // ─── Revoke subscription (set to Free) ───────────────────────────────────

  @Delete('users/:id')
  @ApiOperation({ summary: 'Revoke a user subscription and set to Free (Admin only)' })
  async revokeSubscription(
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: AdminRevokeSubscriptionDto,
    @Request() req,
  ) {
    const result = await this.subscriptionService.adminRevokeSubscription(userId);

    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'ADMIN_REVOKE_SUBSCRIPTION',
      'User',
      userId.toString(),
      { reason: body?.reason, result: result.message },
      'Subscription Manager',
    );

    if (body?.reason?.trim()) {
      const adminId = Number(req.user.id || req.user.userId || null);
      await this.notesService.createNote(
        userId,
        Number.isFinite(adminId) ? adminId : null,
        `Subscription Revoked: ${body.reason}`,
      ).catch(err => console.error('Failed to create subscription revoke note:', err));
    }

    return result;
  }
}
