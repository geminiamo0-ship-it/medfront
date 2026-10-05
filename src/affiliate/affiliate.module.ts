import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { AffiliateReferral } from '../entities/affiliate-referral.entity';
import { PendingPayment } from '../entities/pending-payment.entity';
import { PricingPlan } from '../entities/pricing-plan.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AffiliateReferral,
      PendingPayment,
      PricingPlan,
    ]),
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
