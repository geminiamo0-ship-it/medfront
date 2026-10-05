import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FinanceSetting } from "../entities/finance-setting.entity";
import { Wallet } from "../entities/wallet.entity";
import { WalletLedgerEntry } from "../entities/wallet-ledger-entry.entity";
import { PayrollEmployee } from "../entities/payroll-employee.entity";
import { PayrollExpense } from "../entities/payroll-expense.entity";
import { FinancePartner } from "../entities/finance-partner.entity";
import { PayrollRun } from "../entities/payroll-run.entity";
import { PayrollRunWalletDeduction } from "../entities/payroll-run-wallet-deduction.entity";
import { PayrollRunPartnerAllocation } from "../entities/payroll-run-partner-allocation.entity";
import { PendingPayment } from "../entities/pending-payment.entity";
import { FinanceSettingsService } from "./finance-settings.service";
import { FinanceSettingsController } from "./finance-settings.controller";
import { WalletsService } from "./wallets.service";
import { WalletsController } from "./wallets.controller";
import { PayrollService } from "./payroll.service";
import { PayrollController } from "./payroll.controller";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceSetting,
      Wallet,
      WalletLedgerEntry,
      PayrollEmployee,
      PayrollExpense,
      FinancePartner,
      PayrollRun,
      PayrollRunWalletDeduction,
      PayrollRunPartnerAllocation,
      PendingPayment,
    ]),
    AdminModule,
  ],
  controllers: [
    FinanceSettingsController,
    WalletsController,
    PayrollController,
  ],
  providers: [
    FinanceSettingsService,
    WalletsService,
    PayrollService,
  ],
  exports: [FinanceSettingsService, WalletsService],
})
export class FinanceModule {}
