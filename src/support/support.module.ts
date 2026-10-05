import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { FinanceModule } from '../finance/finance.module';
import { AdminModule } from '../admin/admin.module';

/**
 * Support dashboard backend. Reuses ManualPaymentService (SubscriptionsModule),
 * WalletsService (FinanceModule) and AdminHistoryService (AdminModule); declares
 * no providers of its own. It is a leaf module (nothing imports it back), so
 * there is no circular dependency from exporting ManualPaymentService.
 */
@Module({
  imports: [SubscriptionsModule, FinanceModule, AdminModule],
  controllers: [SupportController],
})
export class SupportModule {}
