import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { PayrollEmployee } from "../entities/payroll-employee.entity";
import { PayrollExpense, PayrollExpenseCategory } from "../entities/payroll-expense.entity";
import { FinancePartner } from "../entities/finance-partner.entity";
import { PayrollRun } from "../entities/payroll-run.entity";
import { PayrollRunWalletDeduction } from "../entities/payroll-run-wallet-deduction.entity";
import { PayrollRunPartnerAllocation } from "../entities/payroll-run-partner-allocation.entity";
import { Wallet } from "../entities/wallet.entity";
import { WalletsService } from "./wallets.service";
import { FinanceSettingsService } from "./finance-settings.service";

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(PayrollEmployee)
    private employeeRepo: Repository<PayrollEmployee>,
    @InjectRepository(PayrollExpense)
    private expenseRepo: Repository<PayrollExpense>,
    @InjectRepository(FinancePartner)
    private partnerRepo: Repository<FinancePartner>,
    @InjectRepository(PayrollRun)
    private runRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollRunWalletDeduction)
    private deductionRepo: Repository<PayrollRunWalletDeduction>,
    @InjectRepository(PayrollRunPartnerAllocation)
    private allocationRepo: Repository<PayrollRunPartnerAllocation>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    @InjectDataSource()
    private dataSource: DataSource,
    private walletsService: WalletsService,
    private financeSettingsService: FinanceSettingsService,
  ) {}

  // ─── Employees ────────────────────────────────────────────────────────────

  async listEmployees(month: number, year: number) {
    return this.employeeRepo.find({ where: { month, year, isActive: true }, order: { name: "ASC" } });
  }

  async createEmployee(body: { name: string; role: string; fixedMonthlySalary: number; currency: string; month: number; year: number }) {
    const emp = this.employeeRepo.create({ ...body, currency: (body.currency || "EGP").toUpperCase() });
    return this.employeeRepo.save(emp);
  }

  async updateEmployee(id: number, body: Partial<{ name: string; role: string; fixedMonthlySalary: number; currency: string; isActive: boolean }>) {
    const emp = await this.employeeRepo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException("Employee not found");
    Object.assign(emp, body);
    if (body.currency) emp.currency = body.currency.toUpperCase();
    return this.employeeRepo.save(emp);
  }

  async deleteEmployee(id: number) {
    const emp = await this.employeeRepo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException("Employee not found");
    await this.employeeRepo.remove(emp);
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async listExpenses(month: number, year: number) {
    return this.expenseRepo.find({ where: { month, year }, order: { name: "ASC" } });
  }

  async createExpense(body: { name: string; category: PayrollExpenseCategory; amount: number; currency: string; month: number; year: number; isTemplate?: boolean }) {
    const exp = this.expenseRepo.create({ ...body, currency: (body.currency || "EGP").toUpperCase() });
    return this.expenseRepo.save(exp);
  }

  async updateExpense(id: number, body: Partial<{ name: string; category: PayrollExpenseCategory; amount: number; currency: string; isTemplate: boolean }>) {
    const exp = await this.expenseRepo.findOne({ where: { id } });
    if (!exp) throw new NotFoundException("Expense not found");
    Object.assign(exp, body);
    if (body.currency) exp.currency = body.currency.toUpperCase();
    return this.expenseRepo.save(exp);
  }

  async deleteExpense(id: number) {
    const exp = await this.expenseRepo.findOne({ where: { id } });
    if (!exp) throw new NotFoundException("Expense not found");
    await this.expenseRepo.remove(exp);
  }

  async applyTemplates(month: number, year: number) {
    const templates = await this.expenseRepo.find({ where: { isTemplate: true } });
    const created: PayrollExpense[] = [];
    for (const t of templates) {
      const exists = await this.expenseRepo.findOne({ where: { name: t.name, month, year } });
      if (!exists) {
        const exp = this.expenseRepo.create({ name: t.name, category: t.category, amount: t.amount, currency: t.currency, month, year, isTemplate: false });
        created.push(await this.expenseRepo.save(exp));
      }
    }
    return created;
  }

  // ─── Finance Partners ──────────────────────────────────────────────────────

  async listPartners() {
    return this.partnerRepo.find({ order: { name: "ASC" } });
  }

  async createPartner(body: { name: string; equityPercent: number }) {
    if (Number(body.equityPercent) <= 0) {
      throw new BadRequestException("Equity percent must be greater than 0");
    }
    const currentSum = await this.getEquitySum();
    if (currentSum + Number(body.equityPercent) > 100 + 0.001) {
      throw new BadRequestException(`Adding this partner would exceed 100% equity (current: ${currentSum}%)`);
    }
    const partner = this.partnerRepo.create(body);
    return this.partnerRepo.save(partner);
  }

  async updatePartner(id: number, body: Partial<{ name: string; equityPercent: number }>) {
    const partner = await this.partnerRepo.findOne({ where: { id } });
    if (!partner) throw new NotFoundException("Partner not found");
    if (body.equityPercent !== undefined && Number(body.equityPercent) <= 0) {
      throw new BadRequestException("Equity percent must be greater than 0");
    }
    const oldEquity = Number(partner.equityPercent);
    const newEquity = body.equityPercent !== undefined ? Number(body.equityPercent) : oldEquity;
    const currentSum = await this.getEquitySum();
    const projectedSum = currentSum - oldEquity + newEquity;
    if (projectedSum > 100 + 0.001) {
      throw new BadRequestException(`Update would exceed 100% equity (projected: ${projectedSum.toFixed(2)}%)`);
    }
    Object.assign(partner, body);
    return this.partnerRepo.save(partner);
  }

  async deletePartner(id: number) {
    const partner = await this.partnerRepo.findOne({ where: { id } });
    if (!partner) throw new NotFoundException("Partner not found");
    await this.partnerRepo.remove(partner);
  }

  private async getEquitySum(): Promise<number> {
    const result = await this.partnerRepo
      .createQueryBuilder("p")
      .select("COALESCE(SUM(p.equity_percent), 0)", "total")
      .getRawOne<{ total: string }>();
    return Number(result?.total || 0);
  }

  // ─── Snapshot ─────────────────────────────────────────────────────────────

  async getSnapshot(from?: string, to?: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const settings = await this.financeSettingsService.getSettings();
    const rate = Number(settings.usdToEgpRate);
    const master = settings.masterCurrency.toUpperCase();

    const summary = await this.walletsService.getSummary(from, to);
    const totalWallets = summary.grandTotal;

    const employees = await this.employeeRepo.find({ where: { month, year, isActive: true } });
    let totalSalaries = 0;
    for (const e of employees) {
      totalSalaries += this.toMaster(Number(e.fixedMonthlySalary), e.currency, master, rate);
    }

    const expenses = await this.expenseRepo.find({ where: { month, year } });
    let totalExpenses = 0;
    for (const e of expenses) {
      totalExpenses += this.toMaster(Number(e.amount), e.currency, master, rate);
    }

    return {
      success: true,
      masterCurrency: master,
      totalWallets,
      totalSalaries,
      totalExpenses,
      netProfit: totalWallets - totalSalaries - totalExpenses,
      month,
      year,
      rateInfo: { usdToEgpRate: rate, rateUpdatedAt: settings.rateUpdatedAt },
    };
  }

  async getDeductionStatus(month: number, year: number) {
    const lastRun = await this.runRepo.findOne({
      where: {},
      order: { createdAt: "DESC" },
    });

    const runsThisMonth = await this.runRepo
      .createQueryBuilder("r")
      .where("EXTRACT(MONTH FROM r.created_at) = :month", { month })
      .andWhere("EXTRACT(YEAR FROM r.created_at) = :year", { year })
      .getMany();

    const salariedRun = runsThisMonth.find((r) => r.salariedThisMonth);
    const expensesRun = runsThisMonth.find((r) => r.expensesDeductedThisMonth);

    return {
      success: true,
      month,
      year,
      salariedThisMonth: !!salariedRun,
      salariedAt: salariedRun?.createdAt || null,
      expensesDeductedThisMonth: !!expensesRun,
      expensesDeductedAt: expensesRun?.createdAt || null,
    };
  }

  // ─── Payroll Run ──────────────────────────────────────────────────────────

  async executePayrollRun(body: {
    totalPayout: number;
    currency: string;
    salariedThisMonth: boolean;
    expensesDeductedThisMonth: boolean;
    walletDistribution: Array<{ walletId: number; amount: number }>;
    adminId: number;
    adminEmail: string;
  }) {
    // Validate wallet distribution sums to total payout (pre-transaction check)
    const distributionTotal = body.walletDistribution.reduce((s, w) => s + Number(w.amount), 0);
    if (Math.abs(distributionTotal - Number(body.totalPayout)) > 0.01) {
      throw new BadRequestException(
        `Wallet distribution total (${distributionTotal}) does not match payout amount (${body.totalPayout})`,
      );
    }

    const settings = await this.financeSettingsService.getSettings();
    const masterCurrency = settings.masterCurrency.toUpperCase();
    const usdToEgpRate = Number(settings.usdToEgpRate);

    // Validate total against combined wallet balances (pre-transaction check)
    const summary = await this.walletsService.getSummary();
    if (Number(body.totalPayout) > summary.grandTotal + 0.01) {
      throw new BadRequestException(
        `Payout amount (${body.totalPayout}) exceeds total wallet balance (${summary.grandTotal.toFixed(2)})`,
      );
    }

    // Validate partner equity sums to 100% (pre-transaction check)
    const partners = await this.partnerRepo.find({ order: { name: "ASC" } });
    const equitySum = partners.reduce((s, p) => s + Number(p.equityPercent), 0);
    if (Math.abs(equitySum - 100) > 0.01) {
      throw new BadRequestException(`Partner equity does not sum to 100% (current: ${equitySum.toFixed(2)}%)`);
    }

    // Resolve wallets and convert distribution amounts to each wallet's native currency
    const resolvedDistribution: Array<{ walletId: number; nativeAmount: number; walletName: string }> = [];
    for (const wd of body.walletDistribution) {
      const wallet = await this.walletRepo.findOne({ where: { id: wd.walletId, isActive: true } });
      if (!wallet) throw new NotFoundException(`Wallet ${wd.walletId} not found or inactive`);

      // wd.amount is in master currency — convert to wallet's native currency
      const masterAmount = Number(wd.amount);
      let nativeAmount: number;
      const walletCurrency = wallet.baseCurrency.toUpperCase();
      if (walletCurrency === masterCurrency) {
        nativeAmount = masterAmount;
      } else if (walletCurrency === "USD" && masterCurrency === "EGP") {
        nativeAmount = masterAmount / usdToEgpRate;
      } else if (walletCurrency === "EGP" && masterCurrency === "USD") {
        nativeAmount = masterAmount * usdToEgpRate;
      } else {
        nativeAmount = masterAmount;
      }

      resolvedDistribution.push({ walletId: wd.walletId, nativeAmount: parseFloat(nativeAmount.toFixed(2)), walletName: wallet.name });
    }

    // Execute all writes inside a single DB transaction to prevent TOCTOU races
    const runId = await this.dataSource.transaction(async (manager: EntityManager) => {
      // Re-validate each wallet balance inside the transaction (serializable check)
      for (const rd of resolvedDistribution) {
        const walletBalance = await this.walletsService.getWalletBalance(rd.walletId);
        if (rd.nativeAmount > walletBalance + 0.01) {
          const wallet = await manager.findOne(Wallet, { where: { id: rd.walletId } });
          throw new BadRequestException(
            `Wallet "${wallet?.name ?? rd.walletId}" has insufficient balance (${walletBalance.toFixed(2)} available, ${rd.nativeAmount.toFixed(2)} requested)`,
          );
        }
      }

      // Create payroll run record
      const runEntity = manager.create(PayrollRun, {
        totalDistributed: Number(body.totalPayout),
        currency: (body.currency || masterCurrency).toUpperCase(),
        salariedThisMonth: body.salariedThisMonth,
        expensesDeductedThisMonth: body.expensesDeductedThisMonth,
        adminId: body.adminId,
        adminEmail: body.adminEmail,
      });
      const savedRun = await manager.save(PayrollRun, runEntity);

      // Create wallet deduction records in native currency
      for (const rd of resolvedDistribution) {
        const deduction = manager.create(PayrollRunWalletDeduction, {
          payrollRunId: savedRun.id,
          walletId: rd.walletId,
          walletNameSnapshot: rd.walletName,
          amount: rd.nativeAmount,
        });
        await manager.save(PayrollRunWalletDeduction, deduction);
      }

      // Create partner allocation records
      for (const partner of partners) {
        const partnerAmount = (Number(body.totalPayout) * Number(partner.equityPercent)) / 100;
        const allocation = manager.create(PayrollRunPartnerAllocation, {
          payrollRunId: savedRun.id,
          partnerId: partner.id,
          partnerNameSnapshot: partner.name,
          equityPercentSnapshot: Number(partner.equityPercent),
          amount: parseFloat(partnerAmount.toFixed(2)),
        });
        await manager.save(PayrollRunPartnerAllocation, allocation);
      }

      return savedRun.id;
    });

    return this.getRunDetail(runId);
  }

  async getPayrollHistory(limit = 20, offset = 0) {
    const [runs, total] = await this.runRepo
      .createQueryBuilder("r")
      .orderBy("r.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(runs.map((r) => this.getRunDetail(r.id)));
    return { success: true, total, data };
  }

  async getRunDetail(runId: number) {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException("Payroll run not found");

    const deductions = await this.deductionRepo.find({ where: { payrollRunId: runId } });
    const allocations = await this.allocationRepo.find({ where: { payrollRunId: runId } });

    return {
      id: run.id,
      createdAt: run.createdAt,
      totalDistributed: run.totalDistributed,
      currency: run.currency,
      salariedThisMonth: run.salariedThisMonth,
      expensesDeductedThisMonth: run.expensesDeductedThisMonth,
      adminId: run.adminId,
      adminEmail: run.adminEmail,
      walletDeductions: deductions.map((d) => ({
        walletId: d.walletId,
        walletName: d.walletNameSnapshot,
        amount: d.amount,
      })),
      partnerAllocations: allocations.map((a) => ({
        partnerId: a.partnerId,
        partnerName: a.partnerNameSnapshot,
        equityPercent: a.equityPercentSnapshot,
        amount: a.amount,
      })),
    };
  }

  private toMaster(amount: number, fromCurrency: string, masterCurrency: string, rate: number): number {
    const from = fromCurrency.toUpperCase();
    const master = masterCurrency.toUpperCase();
    if (from === master) return amount;
    if (from === "USD" && master === "EGP") return amount * rate;
    if (from === "EGP" && master === "USD") return amount / rate;
    return amount;
  }
}
