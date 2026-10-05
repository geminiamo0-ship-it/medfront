import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { PayrollService } from "./payroll.service";
import { PayrollExpenseCategory } from "../entities/payroll-expense.entity";
import { AdminHistoryService } from "../admin/admin-history.service";

@ApiTags("Admin - Payroll")
@Controller("admin/payroll")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly historyService: AdminHistoryService,
  ) {}

  // ─── Employees ────────────────────────────────────────────────────────────

  @Get("employees")
  async listEmployees(@Query("month") month: string, @Query("year") year: string) {
    const now = new Date();
    const data = await this.payrollService.listEmployees(Number(month) || now.getMonth() + 1, Number(year) || now.getFullYear());
    return { success: true, data };
  }

  @Post("employees")
  async createEmployee(
    @Request() req,
    @Body() body: { name: string; role: string; fixedMonthlySalary: number; currency: string; month: number; year: number },
  ) {
    const emp = await this.payrollService.createEmployee(body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "CREATE_PAYROLL_EMPLOYEE", "PayrollEmployee", emp.id.toString(), body, "Payroll");
    return { success: true, data: emp };
  }

  @Patch("employees/:id")
  async updateEmployee(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; role: string; fixedMonthlySalary: number; currency: string; isActive: boolean }>,
  ) {
    const emp = await this.payrollService.updateEmployee(id, body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "UPDATE_PAYROLL_EMPLOYEE", "PayrollEmployee", id.toString(), body, "Payroll");
    return { success: true, data: emp };
  }

  @Delete("employees/:id")
  async deleteEmployee(@Request() req, @Param("id", ParseIntPipe) id: number) {
    await this.payrollService.deleteEmployee(id);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "DELETE_PAYROLL_EMPLOYEE", "PayrollEmployee", id.toString(), null, "Payroll");
    return { success: true };
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  @Get("expenses")
  async listExpenses(@Query("month") month: string, @Query("year") year: string) {
    const now = new Date();
    const data = await this.payrollService.listExpenses(Number(month) || now.getMonth() + 1, Number(year) || now.getFullYear());
    return { success: true, data };
  }

  @Post("expenses")
  async createExpense(
    @Request() req,
    @Body() body: { name: string; category: PayrollExpenseCategory; amount: number; currency: string; month: number; year: number; isTemplate?: boolean },
  ) {
    const exp = await this.payrollService.createExpense(body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "CREATE_PAYROLL_EXPENSE", "PayrollExpense", exp.id.toString(), body, "Payroll");
    return { success: true, data: exp };
  }

  @Post("expenses/apply-templates")
  async applyTemplates(@Query("month") month: string, @Query("year") year: string) {
    const now = new Date();
    const created = await this.payrollService.applyTemplates(Number(month) || now.getMonth() + 1, Number(year) || now.getFullYear());
    return { success: true, created };
  }

  @Patch("expenses/:id")
  async updateExpense(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; category: PayrollExpenseCategory; amount: number; currency: string; isTemplate: boolean }>,
  ) {
    const exp = await this.payrollService.updateExpense(id, body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "UPDATE_PAYROLL_EXPENSE", "PayrollExpense", id.toString(), body, "Payroll");
    return { success: true, data: exp };
  }

  @Delete("expenses/:id")
  async deleteExpense(@Request() req, @Param("id", ParseIntPipe) id: number) {
    await this.payrollService.deleteExpense(id);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "DELETE_PAYROLL_EXPENSE", "PayrollExpense", id.toString(), null, "Payroll");
    return { success: true };
  }

  // ─── Partners ─────────────────────────────────────────────────────────────

  @Get("partners")
  async listPartners() {
    const data = await this.payrollService.listPartners();
    const equitySum = data.reduce((s, p) => s + Number(p.equityPercent), 0);
    return { success: true, data, equitySum: parseFloat(equitySum.toFixed(2)) };
  }

  @Post("partners")
  async createPartner(
    @Request() req,
    @Body() body: { name: string; equityPercent: number },
  ) {
    const partner = await this.payrollService.createPartner(body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "CREATE_FINANCE_PARTNER", "FinancePartner", partner.id.toString(), body, "Payroll");
    return { success: true, data: partner };
  }

  @Patch("partners/:id")
  async updatePartner(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; equityPercent: number }>,
  ) {
    const partner = await this.payrollService.updatePartner(id, body);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "UPDATE_FINANCE_PARTNER", "FinancePartner", id.toString(), body, "Payroll");
    return { success: true, data: partner };
  }

  @Delete("partners/:id")
  async deletePartner(@Request() req, @Param("id", ParseIntPipe) id: number) {
    await this.payrollService.deletePartner(id);
    await this.historyService.record(req.user.email || req.user.id?.toString(), "DELETE_FINANCE_PARTNER", "FinancePartner", id.toString(), null, "Payroll");
    return { success: true };
  }

  // ─── Snapshot & Run ───────────────────────────────────────────────────────

  @Get("snapshot")
  async getSnapshot(@Query("from") from?: string, @Query("to") to?: string) {
    return this.payrollService.getSnapshot(from, to);
  }

  @Get("deduction-status")
  async getDeductionStatus(@Query("month") month: string, @Query("year") year: string) {
    const now = new Date();
    return this.payrollService.getDeductionStatus(Number(month) || now.getMonth() + 1, Number(year) || now.getFullYear());
  }

  @Post("run")
  @ApiOperation({ summary: "Execute a payroll run" })
  async executeRun(
    @Request() req,
    @Body() body: {
      totalPayout: number;
      currency: string;
      salariedThisMonth: boolean;
      expensesDeductedThisMonth: boolean;
      walletDistribution: Array<{ walletId: number; amount: number }>;
    },
  ) {
    const result = await this.payrollService.executePayrollRun({
      ...body,
      adminId: Number(req.user.id),
      adminEmail: req.user.email,
    });
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "EXECUTE_PAYROLL_RUN",
      "PayrollRun",
      result.id.toString(),
      { totalPayout: body.totalPayout, currency: body.currency },
      "Payroll",
    );
    return { success: true, data: result };
  }

  @Get("history")
  async getHistory(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.payrollService.getPayrollHistory(Number(limit) || 20, Number(offset) || 0);
  }

  @Get("history/:id")
  async getRunDetail(@Param("id", ParseIntPipe) id: number) {
    const data = await this.payrollService.getRunDetail(id);
    return { success: true, data };
  }
}
