import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ManualPaymentService } from '../subscriptions/manual-payment.service';
import { WalletsService } from '../finance/wallets.service';
import { AdminHistoryService } from '../admin/admin-history.service';
import { UserRole } from '../entities/user.entity';
import { PaymentStatus } from '../entities/pending-payment.entity';

/**
 * Support "Account Activation" API.
 *
 * Lets the support team approve manual payments (which activates the user's
 * subscription) WITHOUT exposing any wallet balances, financial KPIs, analytics
 * or admin tooling. It deliberately:
 *   - uses ONLY JwtAuthGuard + RolesGuard (NO AdminGateGuard / second factor),
 *   - is restricted to the `support`, `admin` and `super_admin` roles,
 *   - returns the safe wallet list (no balances) via WalletsService.listWalletsBasic(),
 *   - reuses the same ManualPaymentService approval logic as admin, and
 *   - records every action into the shared admin audit history, tagged
 *     `actorRole: 'support'` so admins can monitor support activity.
 */
@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SupportController {
  constructor(
    private readonly manualPaymentService: ManualPaymentService,
    private readonly walletsService: WalletsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  /** Actor email for audit attribution (falls back to id if email missing). */
  private actorEmail(user: any): string {
    return user?.email || user?.userId?.toString() || user?.id?.toString();
  }

  private actorId(user: any): number {
    return Number(user?.id || user?.userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List all pending payments (Support)' })
  async getAllPendingPayments() {
    return this.manualPaymentService.getAllPendingPayments();
  }

  @Get()
  @ApiOperation({ summary: 'List payments by status (Support)' })
  async getPayments(
    @Query('status') status: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    const normalizedStatus = (status || PaymentStatus.PENDING).toLowerCase();
    const allowedStatuses = Object.values(PaymentStatus);
    if (!allowedStatuses.includes(normalizedStatus as PaymentStatus)) {
      throw new BadRequestException('Invalid payment status');
    }
    // Clamp the page size so a support user can't force an oversized scan.
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const parsedOffset = Math.max(0, Number(offset) || 0);
    return this.manualPaymentService.getPaymentsByStatus(
      normalizedStatus as PaymentStatus,
      parsedLimit,
      parsedOffset,
      search,
    );
  }

  @Get('wallets')
  @ApiOperation({ summary: 'List wallets (names only, no balances) for selection (Support)' })
  async listWallets() {
    // listWalletsBasic returns ONLY { id, name, baseCurrency, type } — never balances.
    return this.walletsService.listWalletsBasic();
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a payment to activate the account (Support)' })
  async approvePayment(
    @Request() req,
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: {
      approvalTag: string;
      approvalNote?: string;
      walletId?: number;
      actualAmount?: number;
      approvalCurrency?: string;
      commissionAmount?: number;
    },
  ) {
    const result = await this.manualPaymentService.approvePayment(
      paymentId,
      this.actorId(req.user),
      body?.approvalTag,
      body?.approvalNote,
      body?.walletId,
      body?.actualAmount !== undefined ? Number(body.actualAmount) : undefined,
      body?.approvalCurrency,
      body?.commissionAmount !== undefined ? Number(body.commissionAmount) : undefined,
    );

    const email = this.actorEmail(req.user);
    await this.historyService.record(
      email,
      'APPROVE_PAYMENT',
      'PendingPayment',
      paymentId.toString(),
      { ...(result?.data || {}), actorRole: 'support' },
      'Support Approvals',
    );
    if (result?.confirmed) {
      await this.historyService.record(
        email,
        'CONFIRM_PAYMENT',
        'PendingPayment',
        paymentId.toString(),
        { ...(result?.data || {}), actorRole: 'support' },
        'Support Approvals',
      );
    }

    return result;
  }

  @Post('reference/:reference/approve')
  @ApiOperation({ summary: 'Approve a payment by reference (Support)' })
  async approvePaymentByReference(
    @Request() req,
    @Param('reference') reference: string,
    @Body() body: { approvalTag: string; approvalNote?: string },
  ) {
    const result = await this.manualPaymentService.approvePaymentByReference(
      reference,
      this.actorId(req.user),
      body?.approvalTag,
      body?.approvalNote,
    );

    const email = this.actorEmail(req.user);
    await this.historyService.record(
      email,
      'APPROVE_PAYMENT',
      'PendingPayment',
      reference,
      { ...(result?.data || { paymentReference: reference }), actorRole: 'support' },
      'Support Approvals',
    );
    if (result?.confirmed) {
      await this.historyService.record(
        email,
        'CONFIRM_PAYMENT',
        'PendingPayment',
        reference,
        { ...(result?.data || { paymentReference: reference }), actorRole: 'support' },
        'Support Approvals',
      );
    }

    return result;
  }
}
