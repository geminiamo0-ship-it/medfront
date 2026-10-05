import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { PendingPayment } from '../entities/pending-payment.entity';
import { PaymentApproval } from '../entities/payment-approval.entity';
import { PromoCode } from '../entities/promo-code.entity';
import { PricingPlan } from '../entities/pricing-plan.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { WalletLedgerEntry } from '../entities/wallet-ledger-entry.entity';
import { Wallet } from '../entities/wallet.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionGuard } from './subscription.guard';
import { ManualPaymentService } from './manual-payment.service';
import { ManualPaymentController } from './manual-payment.controller';
import { AdminPaymentController } from './admin-payment.controller';
import { MrShadyPaymentController } from './mrshady-payment.controller';
import { PricingPlansService } from './pricing-plans.service';
import { PricingPlansController } from './pricing-plans.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AdminModule } from '../admin/admin.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { TelegramService } from "../integrations/telegram.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      PendingPayment,
      PaymentApproval,
      PromoCode,
      PricingPlan,
      QuestionBank,
      WalletLedgerEntry,
      Wallet,
    ]),
    AffiliateModule,
    AdminModule,
    SettingsModule,
    UsersModule,
  ],
  controllers: [
    SubscriptionController,
    ManualPaymentController,
    AdminPaymentController,
    MrShadyPaymentController,
    PricingPlansController,
    AdminPlansController,
    AdminSettingsController,
    AdminSubscriptionsController,
  ],
  providers: [
    SubscriptionService,
    SubscriptionGuard,
    ManualPaymentService,
    PricingPlansService,
    TelegramService,
  ],
  exports: [SubscriptionService, SubscriptionGuard, ManualPaymentService],
})
export class SubscriptionsModule {}
