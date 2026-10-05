import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PricingPlansService } from './pricing-plans.service';

@ApiTags('Subscriptions - Plans')
@Controller('subscriptions')
export class PricingPlansController {
  constructor(private readonly pricingPlansService: PricingPlansService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get active subscription plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved' })
  async getActivePlans() {
    const plans = await this.pricingPlansService.getActivePlans();
    return { success: true, data: plans };
  }
}
