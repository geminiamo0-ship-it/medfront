import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ManualPaymentService } from './manual-payment.service';
import { UserRole } from '../entities/user.entity';
import { PaymentStatus } from '../entities/pending-payment.entity';
import { AdminHistoryService } from '../admin/admin-history.service';
import { AdminGateGuard } from '../admin/admin-gate.guard';

@ApiTags('Admin - Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminPaymentController {
  constructor(
    private readonly manualPaymentService: ManualPaymentService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending payments (Admin only)' })
  @ApiResponse({ status: 200, description: 'Pending payments retrieved' })
  async getAllPendingPayments(@Request() req) {
    this.checkAdminRole(req.user);
    return this.manualPaymentService.getAllPendingPayments();
  }

  @Get()
  @ApiOperation({ summary: 'Get payments by status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payments retrieved' })
  async getPayments(
    @Request() req,
    @Query('status') status: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    this.checkAdminRole(req.user);
    const normalizedStatus = (status || PaymentStatus.PENDING).toLowerCase();
    const allowedStatuses = Object.values(PaymentStatus);
    if (!allowedStatuses.includes(normalizedStatus as PaymentStatus)) {
      throw new BadRequestException('Invalid payment status');
    }

    const parsedLimit = Math.max(1, Number(limit) || 20);
    const parsedOffset = Math.max(0, Number(offset) || 0);

    return this.manualPaymentService.getPaymentsByStatus(
      normalizedStatus as PaymentStatus,
      parsedLimit,
      parsedOffset,
      search,
    );
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get premium earnings overview (Admin only)' })
  @ApiResponse({ status: 200, description: 'Premium earnings retrieved' })
  async getPremiumEarnings(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.checkAdminRole(req.user);
    const parsedLimit = Math.max(1, Number(limit) || 20);
    const parsedOffset = Math.max(0, Number(offset) || 0);
    return this.manualPaymentService.getPremiumEarnings(
      parsedLimit,
      parsedOffset,
      search,
      from,
      to,
    );
  }

  @Patch(':id/actual-amount')
  @ApiOperation({ summary: 'Update actual amount collected (Admin only)' })
  @ApiResponse({ status: 200, description: 'Amount updated' })
  async updateActualAmount(
    @Request() req,
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: { actualAmount: number; note?: string },
  ) {
    this.checkAdminRole(req.user);
    const result = await this.manualPaymentService.updateActualAmount(
      paymentId,
      Number(body.actualAmount),
      body.note,
      Number(req.user.id),
    );

    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_PAYMENT_ACTUAL_AMOUNT',
      'PendingPayment',
      paymentId.toString(),
      { actualAmount: body.actualAmount, note: body.note },
      'Earnings Playground',
    );

    return result;
  }

  @Get('kpi')
  @ApiOperation({ summary: 'Get payment KPI totals (Admin only)' })
  @ApiResponse({ status: 200, description: 'KPI data retrieved' })
  async getKpi(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.checkAdminRole(req.user);
    return this.manualPaymentService.getPaymentKpi(from, to);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment approved' })
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
    this.checkAdminRole(req.user);
    const adminId = Number(req.user.id || req.user.userId);
    const result = await this.manualPaymentService.approvePayment(
      paymentId,
      adminId,
      body?.approvalTag,
      body?.approvalNote,
      body?.walletId,
      body?.actualAmount !== undefined ? Number(body.actualAmount) : undefined,
      body?.approvalCurrency,
      body?.commissionAmount !== undefined ? Number(body.commissionAmount) : undefined,
    );

    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'APPROVE_PAYMENT',
      'PendingPayment',
      paymentId.toString(),
      result?.data,
      'Payments',
    );

    if (result?.confirmed) {
      await this.historyService.record(
        req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
        'CONFIRM_PAYMENT',
        'PendingPayment',
        paymentId.toString(),
        result?.data,
        'Payments',
      );
    }

    return result;
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment and activate subscription (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  async confirmPayment(
    @Request() req,
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: { approvalTag: string; approvalNote?: string },
  ) {
    this.checkAdminRole(req.user);
    return this.approvePayment(req, paymentId, body);
  }

  @Post('reference/:reference/approve')
  @ApiOperation({ summary: 'Approve a payment by reference (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment approved by reference' })
  async approvePaymentByReference(
    @Request() req,
    @Param('reference') reference: string,
    @Body() body: { approvalTag: string; approvalNote?: string },
  ) {
    this.checkAdminRole(req.user);
    const adminId = Number(req.user.id || req.user.userId);
    const result = await this.manualPaymentService.approvePaymentByReference(
      reference,
      adminId,
      body?.approvalTag,
      body?.approvalNote,
    );

    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'APPROVE_PAYMENT',
      'PendingPayment',
      reference,
      result?.data || { paymentReference: reference },
      'Payments',
    );

    if (result?.confirmed) {
      await this.historyService.record(
        req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
        'CONFIRM_PAYMENT',
        'PendingPayment',
        reference,
        result?.data || { paymentReference: reference },
        'Payments',
      );
    }

    return result;
  }

  @Post('reference/:reference/confirm')
  @ApiOperation({ summary: 'Confirm a payment by reference (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed by reference' })
  async confirmPaymentByReference(
    @Request() req,
    @Param('reference') reference: string,
    @Body() body: { approvalTag: string; approvalNote?: string },
  ) {
    this.checkAdminRole(req.user);
    return this.approvePaymentByReference(req, reference, body);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get payments analytics (Admin only)' })
  async getAnalytics(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tzOffsetMinutes') tzOffsetMinutes?: string,
    @Query('tag') tag?: string,
  ) {
    this.checkAdminRole(req.user);
    const tzOffset = Number(tzOffsetMinutes || 0);
    return this.manualPaymentService.getPaymentAnalytics(
      from,
      to,
      Number.isFinite(tzOffset) ? tzOffset : 0,
      tag,
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment rejected' })
  async rejectPayment(
    @Request() req,
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: { reason: string },
  ) {
    this.checkAdminRole(req.user);
    const result = await this.manualPaymentService.rejectPayment(
      paymentId,
      Number(req.user.id || req.user.userId),
      body.reason,
    );
    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'REJECT_PAYMENT',
      'PendingPayment',
      paymentId.toString(),
      result?.data || { reason: body.reason },
      'Payments',
    );
    return result;
  }
}
