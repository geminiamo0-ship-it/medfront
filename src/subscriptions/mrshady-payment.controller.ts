import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ManualPaymentService } from './manual-payment.service';
import { AdminHistoryService } from '../admin/admin-history.service';
import { UserRole } from '../entities/user.entity';

@ApiTags('Local - Payments')
@Controller('mrshady/payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MrShadyPaymentController {
  constructor(
    private readonly manualPaymentService: ManualPaymentService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private ensureLocalOnly(req: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Local endpoint not available in production');
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded as string | undefined)?.split(',')[0]?.trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        '';

    const normalizedIp = (ip || '').trim();
    const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

    if (!allowedIps.includes(normalizedIp)) {
      throw new ForbiddenException('Local access only');
    }
  }

  private ensureSuperAdmin(user: any) {
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Local force confirm payment by ID (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  async forceConfirmPayment(@Request() req, @Param('id', ParseIntPipe) paymentId: number) {
    this.ensureLocalOnly(req);
    this.ensureSuperAdmin(req.user);

    const adminId = Number(req.user.id || req.user.userId);
    const result = await this.manualPaymentService.forceConfirmPayment(paymentId, adminId);

    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'FORCE_CONFIRM_PAYMENT',
      'PendingPayment',
      paymentId.toString(),
      result?.data,
      'Payments',
    );

    return result;
  }

  @Post('reference/:reference/approve')
  @ApiOperation({ summary: 'Local force confirm payment by reference (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed by reference' })
  async forceConfirmPaymentByReference(
    @Request() req,
    @Param('reference') reference: string,
  ) {
    this.ensureLocalOnly(req);
    this.ensureSuperAdmin(req.user);

    const adminId = Number(req.user.id || req.user.userId);
    const result = await this.manualPaymentService.forceConfirmPaymentByReference(
      reference,
      adminId,
    );

    await this.historyService.record(
      req.user.email || req.user.userId?.toString() || req.user.id?.toString(),
      'FORCE_CONFIRM_PAYMENT',
      'PendingPayment',
      reference,
      result?.data || { paymentReference: reference },
      'Payments',
    );

    return result;
  }
}
