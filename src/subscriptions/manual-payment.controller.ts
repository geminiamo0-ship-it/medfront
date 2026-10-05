import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ManualPaymentService } from './manual-payment.service';

@ApiTags('Manual Payments')
@Controller('payments/manual')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManualPaymentController {
  constructor(private readonly manualPaymentService: ManualPaymentService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a manual payment request' })
  @ApiResponse({ status: 201, description: 'Payment request created' })
  async initiatePayment(
    @Request() req,
    @Body()
    body: {
      planCode: string;
      telegramUsername?: string;
      promoCode?: string;
      currency?: string;
    },
  ) {
    return this.manualPaymentService.initiatePayment(
      req.user.id,
      body.planCode,
      body.telegramUsername,
      body.promoCode,
      body.currency,
    );
  }

  @Post('verify-promo')
  @ApiOperation({ summary: 'Verify a promo code' })
  @ApiResponse({ status: 200, description: 'Promo code verified' })
  async verifyPromoCode(@Request() req, @Body() body: { promoCode: string }) {
    return this.manualPaymentService.verifyPromoCode(req.user.id, body.promoCode);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get user pending payments' })
  @ApiResponse({ status: 200, description: 'Pending payments retrieved' })
  async getPendingPayments(@Request() req) {
    return this.manualPaymentService.getPendingPayments(req.user.id);
  }

  @Post(':id/upload-proof')
  @ApiOperation({ summary: 'Upload payment proof screenshot' })
  @ApiResponse({ status: 200, description: 'Proof uploaded successfully' })
  async uploadProof(
    @Request() req,
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: { proofImageUrl: string },
  ) {
    return this.manualPaymentService.uploadPaymentProof(
      req.user.id,
      paymentId,
      body.proofImageUrl,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending payment request' })
  @ApiResponse({ status: 200, description: 'Payment request cancelled' })
  async cancelPayment(@Request() req, @Param('id', ParseIntPipe) paymentId: number) {
    return this.manualPaymentService.cancelPayment(req.user.id, paymentId);
  }
}
