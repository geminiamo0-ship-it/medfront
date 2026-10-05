import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Wallet, WalletType } from "../entities/wallet.entity";
import { WalletLedgerEntry, LedgerEntryType } from "../entities/wallet-ledger-entry.entity";
import { PendingPayment, PaymentStatus } from "../entities/pending-payment.entity";
import { PayrollRunWalletDeduction } from "../entities/payroll-run-wallet-deduction.entity";
import { FinanceSettingsService } from "./finance-settings.service";

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    @InjectRepository(WalletLedgerEntry)
    private ledgerRepo: Repository<WalletLedgerEntry>,
    @InjectRepository(PendingPayment)
    private paymentRepo: Repository<PendingPayment>,
    @InjectRepository(PayrollRunWalletDeduction)
    private deductionRepo: Repository<PayrollRunWalletDeduction>,
    private financeSettingsService: FinanceSettingsService,
  ) {}

  async listWallets(from?: string, to?: string) {
    const wallets = await this.walletRepo.find({ where: { isActive: true }, order: { createdAt: "ASC" } });
    const settings = await this.financeSettingsService.getSettings();

    const walletsWithBalance = await Promise.all(
      wallets.map(async (w) => {
        const balance = await this.getWalletBalance(w.id, from, to);
        const convertedBalance = this.convertToMaster(balance, w.baseCurrency, settings);
        const lastEntry = await this.ledgerRepo.findOne({
          where: { walletId: w.id },
          order: { createdAt: "DESC" },
        });
        return {
          ...w,
          balance,
          convertedBalance,
          convertedCurrency: settings.masterCurrency,
          lastTransactionAt: lastEntry?.createdAt || null,
        };
      }),
    );

    return { success: true, data: walletsWithBalance, settings };
  }

  /**
   * Support-safe wallet list. Returns ONLY non-financial fields so the support
   * dashboard can let the user pick a destination wallet WITHOUT ever receiving
   * balances, converted totals, rates, or account numbers. Do NOT use
   * listWallets() for support — that payload leaks money.
   */
  async listWalletsBasic() {
    const wallets = await this.walletRepo.find({
      where: { isActive: true },
      order: { createdAt: "ASC" },
    });
    return {
      success: true,
      data: wallets.map((w) => ({
        id: w.id,
        name: w.name,
        baseCurrency: w.baseCurrency,
        type: w.type,
      })),
    };
  }

  async getWalletBalance(walletId: number, from?: string, to?: string): Promise<number> {
    // Inflows: approved payments linked to this wallet
    const inQuery = this.ledgerRepo
      .createQueryBuilder("e")
      .select("COALESCE(SUM(e.amount), 0)", "total")
      .where("e.walletId = :walletId", { walletId });

    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) inQuery.andWhere("e.createdAt >= :from", { from: d });
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) inQuery.andWhere("e.createdAt <= :to", { to: d });
    }

    const inRow = await inQuery.getRawOne<{ total: string }>();
    const inflows = Number(inRow?.total || 0);

    // Outflows: payroll run deductions from this wallet (not date-filtered — all historical deductions reduce balance)
    const outRow = await this.deductionRepo
      .createQueryBuilder("d")
      .select("COALESCE(SUM(d.amount), 0)", "total")
      .where("d.walletId = :walletId", { walletId })
      .getRawOne<{ total: string }>();
    const outflows = Number(outRow?.total || 0);

    return inflows - outflows;
  }

  async createWallet(body: { name: string; type: WalletType; accountNumber?: string; baseCurrency: string }) {
    const wallet = this.walletRepo.create({
      name: body.name,
      type: body.type || WalletType.OTHER,
      accountNumber: body.accountNumber || null,
      baseCurrency: (body.baseCurrency || "EGP").toUpperCase(),
    });
    return this.walletRepo.save(wallet);
  }

  async updateWallet(id: number, body: Partial<{ name: string; type: WalletType; accountNumber: string; baseCurrency: string; isActive: boolean }>) {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    if (body.name !== undefined) wallet.name = body.name;
    if (body.type !== undefined) wallet.type = body.type;
    if (body.accountNumber !== undefined) wallet.accountNumber = body.accountNumber;
    if (body.baseCurrency !== undefined) wallet.baseCurrency = body.baseCurrency.toUpperCase();
    if (body.isActive !== undefined) wallet.isActive = body.isActive;
    return this.walletRepo.save(wallet);
  }

  async deleteWallet(id: number) {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    const balance = await this.getWalletBalance(id);
    if (Math.abs(balance) > 0.01) {
      throw new BadRequestException(
        `Cannot deactivate — wallet has a balance of ${balance.toFixed(2)} ${wallet.baseCurrency}. Transfer funds to another wallet first.`,
      );
    }
    wallet.isActive = false;
    await this.walletRepo.save(wallet);
  }

  async transferBalance(sourceId: number, destId: number, amount: number, adminEmail: string) {
    if (sourceId === destId) throw new BadRequestException("Source and destination wallets must be different");
    const source = await this.walletRepo.findOne({ where: { id: sourceId, isActive: true } });
    if (!source) throw new NotFoundException("Source wallet not found");
    const dest = await this.walletRepo.findOne({ where: { id: destId, isActive: true } });
    if (!dest) throw new NotFoundException("Destination wallet not found");

    const balance = await this.getWalletBalance(sourceId);
    if (amount > balance + 0.01) {
      throw new BadRequestException(
        `Transfer amount ${amount.toFixed(2)} exceeds source wallet balance ${balance.toFixed(2)} ${source.baseCurrency}`,
      );
    }

    // Convert amount to destination currency when currencies differ
    const srcCur = source.baseCurrency.toUpperCase();
    const dstCur = dest.baseCurrency.toUpperCase();
    let destAmount = amount;
    if (srcCur !== dstCur) {
      const settings = await this.financeSettingsService.getSettings();
      const rate = Number(settings.usdToEgpRate);
      if (srcCur === "EGP" && dstCur === "USD") destAmount = amount / rate;
      else if (srcCur === "USD" && dstCur === "EGP") destAmount = amount * rate;
      destAmount = parseFloat(destAmount.toFixed(2));
    }

    // Debit source in source currency
    await this.adjustBalance(
      sourceId,
      -amount,
      srcCur,
      `Transfer to "${dest.name}"${srcCur !== dstCur ? ` (converted: ${destAmount.toFixed(2)} ${dstCur})` : ""}`,
      adminEmail,
    );
    // Credit destination in its own native currency
    await this.adjustBalance(
      destId,
      destAmount,
      dstCur,
      `Transfer from "${source.name}"${srcCur !== dstCur ? ` (original: ${amount.toFixed(2)} ${srcCur})` : ""}`,
      adminEmail,
    );

    return { success: true, transferred: amount, currency: srcCur, destReceived: destAmount, destCurrency: dstCur };
  }

  async getWalletLedger(walletId: number, limit = 20, offset = 0) {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException("Wallet not found");

    // Cap per-source at 2 000 rows; merged total is bounded at 4 000 before in-memory sort + paginate
    const ROW_CAP = 2000;

    const entries = await this.ledgerRepo
      .createQueryBuilder("e")
      .leftJoinAndSelect("e.payment", "payment")
      .leftJoinAndSelect("payment.user", "user")
      .where("e.walletId = :walletId", { walletId })
      .orderBy("e.createdAt", "DESC")
      .take(ROW_CAP)
      .getMany();

    // Fetch payroll deductions for this wallet, including run metadata
    const deductions = await this.deductionRepo
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.payrollRun", "run")
      .where("d.walletId = :walletId", { walletId })
      .orderBy("d.id", "DESC")
      .take(ROW_CAP)
      .getMany();

    // Map ledger entries
    const ledgerRows = entries.map((e) => {
      const amount = Number(e.amount);
      const commission = e.commissionAmount !== null && e.commissionAmount !== undefined ? Number(e.commissionAmount) : null;
      const profit = commission !== null ? amount - commission : null;
      return {
        id: e.id as number | string,
        entryType: e.entryType as string,
        amount,
        currency: e.currency,
        commissionAmount: commission,
        profit,
        createdAt: e.createdAt,
        paymentId: e.paymentId,
        paymentReference: e.payment?.paymentReference ?? null,
        userName: e.payment?.user?.name ?? null,
        userEmail: e.payment?.user?.email ?? null,
        approvedByAdminEmail: e.approvedByAdminEmail ?? null,
        note: e.note ?? null,
        payrollRunId: null as number | null,
      };
    });

    // Map payroll deductions as negative outflow rows
    const deductionRows = deductions.map((d) => ({
      id: `pr-${d.id}` as number | string,
      entryType: "PAYROLL_DEDUCTION",
      amount: -Number(d.amount),
      currency: wallet.baseCurrency,
      commissionAmount: null,
      profit: null,
      createdAt: d.payrollRun?.createdAt ?? new Date(0),
      paymentId: null,
      paymentReference: null,
      userName: null,
      userEmail: null,
      approvedByAdminEmail: d.payrollRun?.adminEmail ?? null,
      note: `Payroll Run #${d.payrollRunId}`,
      payrollRunId: d.payrollRunId,
    }));

    // Merge and sort descending by date, then paginate
    const all = [...ledgerRows, ...deductionRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      success: true,
      wallet,
      total: all.length,
      data: all.slice(offset, offset + limit),
    };
  }

  async getSummary(from?: string, to?: string) {
    const wallets = await this.walletRepo.find({ where: { isActive: true } });
    const settings = await this.financeSettingsService.getSettings();

    const currencyTotals: Record<string, number> = {};
    for (const w of wallets) {
      const bal = await this.getWalletBalance(w.id, from, to);
      currencyTotals[w.baseCurrency] = (currencyTotals[w.baseCurrency] || 0) + bal;
    }

    const grandTotal = Object.entries(currencyTotals).reduce((acc, [cur, amt]) => {
      return acc + this.convertToMaster(amt, cur, settings);
    }, 0);

    return {
      success: true,
      currencyTotals,
      grandTotal,
      masterCurrency: settings.masterCurrency,
      usdToEgpRate: settings.usdToEgpRate,
      rateUpdatedAt: settings.rateUpdatedAt,
    };
  }

  async getReconciliation(from?: string, to?: string) {
    // Collected per currency: confirmed payments that went through the wallet system
    const collectedQuery = this.paymentRepo
      .createQueryBuilder("p")
      .select("UPPER(COALESCE(p.approval_currency, p.currency))", "currency")
      .addSelect("SUM(COALESCE(p.actual_amount, p.amount))", "collected")
      .where("p.status = :status", { status: PaymentStatus.CONFIRMED })
      .andWhere("p.wallet_id IS NOT NULL");

    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) collectedQuery.andWhere("p.confirmed_at >= :from", { from: d });
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) collectedQuery.andWhere("p.confirmed_at <= :to", { to: d });
    }

    collectedQuery.groupBy("UPPER(COALESCE(p.approval_currency, p.currency))");
    const collectedRows = await collectedQuery.getRawMany<{ currency: string; collected: string }>();
    const collectedMap: Record<string, number> = {};
    for (const row of collectedRows) {
      collectedMap[row.currency] = Number(row.collected || 0);
    }

    // Wallet inflows per currency: only PAYMENT entries (not manual adjustments)
    // Reconciliation verifies all collected payments were deposited — manual adjustments are opening balances, not collected payments
    // Include inactive wallets: a deactivated wallet still historically received those PAYMENT deposits
    const wallets = await this.walletRepo.find();
    const inflowMap: Record<string, number> = {};
    for (const w of wallets) {
      const inQuery = this.ledgerRepo
        .createQueryBuilder("e")
        .select("COALESCE(SUM(e.amount), 0)", "total")
        .where("e.walletId = :walletId", { walletId: w.id })
        .andWhere("e.entryType = :type", { type: LedgerEntryType.PAYMENT });

      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) inQuery.andWhere("e.createdAt >= :from", { from: d });
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) inQuery.andWhere("e.createdAt <= :to", { to: d });
      }

      const row = await inQuery.getRawOne<{ total: string }>();
      const inflow = Number(row?.total || 0);
      inflowMap[w.baseCurrency.toUpperCase()] = (inflowMap[w.baseCurrency.toUpperCase()] || 0) + inflow;
    }

    // Total payroll paid out (all-time, not date-filtered — reflects actual cash removed)
    const paidOutRows = await this.deductionRepo
      .createQueryBuilder("d")
      .select("UPPER(w.base_currency)", "currency")
      .addSelect("SUM(d.amount)", "paidOut")
      .innerJoin("wallets", "w", "w.id = d.wallet_id")
      .groupBy("UPPER(w.base_currency)")
      .getRawMany<{ currency: string; paidOut: string }>();
    const paidOutMap: Record<string, number> = {};
    for (const r of paidOutRows) paidOutMap[r.currency] = Number(r.paidOut || 0);

    const allCurrencies = new Set([...Object.keys(collectedMap), ...Object.keys(inflowMap)]);
    const checks: Array<{ currency: string; collected: number; inWallets: number; paidOut: number; remaining: number; gap: number; ok: boolean }> = [];
    let isGreen = true;

    for (const cur of allCurrencies) {
      const collected = collectedMap[cur] || 0;
      const inWallets = inflowMap[cur] || 0;  // deposit verification: all collected went into wallets
      const paidOut = paidOutMap[cur] || 0;
      const remaining = inWallets - paidOut;   // current spendable balance
      const gap = Math.abs(collected - inWallets);
      const ok = gap < 0.01;
      if (!ok) isGreen = false;
      checks.push({ currency: cur, collected, inWallets, paidOut, remaining, gap, ok });
    }

    return { success: true, isGreen, checks };
  }

  async createLedgerEntry(
    walletId: number,
    paymentId: number,
    amount: number,
    currency: string,
    commissionAmount?: number,
    approvedByAdminEmail?: string,
  ): Promise<WalletLedgerEntry> {
    const entry = this.ledgerRepo.create({
      walletId,
      paymentId,
      amount,
      currency,
      commissionAmount: commissionAmount ?? null,
      entryType: LedgerEntryType.PAYMENT,
      approvedByAdminEmail: approvedByAdminEmail ?? null,
    });
    return this.ledgerRepo.save(entry);
  }

  async adjustBalance(walletId: number, amount: number, currency: string, note: string, adminEmail?: string): Promise<WalletLedgerEntry> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    const entry = this.ledgerRepo.create({
      walletId,
      paymentId: null,
      amount,
      currency: currency.toUpperCase(),
      commissionAmount: null,
      entryType: LedgerEntryType.MANUAL_ADJUSTMENT,
      note: note || "Manual balance adjustment",
      approvedByAdminEmail: adminEmail ?? null,
    });
    return this.ledgerRepo.save(entry);
  }

  async debitWallet(walletId: number, amount: number): Promise<void> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    // Balance is computed; we validate sufficiency here
    const balance = await this.getWalletBalance(walletId);
    if (amount > balance + 0.01) {
      throw new BadRequestException(`Wallet ${wallet.name} has insufficient balance`);
    }
  }

  private convertToMaster(amount: number, fromCurrency: string, settings: { masterCurrency: string; usdToEgpRate: number }): number {
    const master = settings.masterCurrency.toUpperCase();
    const from = fromCurrency.toUpperCase();
    if (from === master) return amount;
    // USD → EGP
    if (from === "USD" && master === "EGP") return amount * Number(settings.usdToEgpRate);
    // EGP → USD
    if (from === "EGP" && master === "USD") return amount / Number(settings.usdToEgpRate);
    return amount;
  }
}
