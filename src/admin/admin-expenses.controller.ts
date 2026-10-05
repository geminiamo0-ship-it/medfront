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
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "./admin-gate.guard";
import { UserRole } from "../entities/user.entity";
import { AdminExpensesService } from "./admin-expenses.service";
import { AdminHistoryService } from "./admin-history.service";

@ApiTags("Admin - Expenses")
@Controller("admin/expenses")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminExpensesController {
  constructor(
    private readonly expensesService: AdminExpensesService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Admin access required");
    }
  }

  @Get()
  @ApiOperation({ summary: "Get expenses (Admin only)" })
  @ApiResponse({ status: 200, description: "Expenses retrieved" })
  async getExpenses(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("currency") currency?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    this.checkAdminRole(req.user);
    const parsedLimit = Math.max(1, Number(limit) || 20);
    const parsedOffset = Math.max(0, Number(offset) || 0);
    return this.expensesService.getExpenses({
      limit: parsedLimit,
      offset: parsedOffset,
      search,
      category,
      currency,
      from,
      to,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create expense (Admin only)" })
  @ApiResponse({ status: 201, description: "Expense created" })
  async createExpense(
    @Request() req,
    @Body()
    body: {
      category: string;
      amount: number;
      currency?: string;
      note?: string;
      incurredAt?: string;
    },
  ) {
    this.checkAdminRole(req.user);
    const expense = await this.expensesService.createExpense(
      body,
      Number(req.user.id),
    );
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "CREATE_EXPENSE",
      "AdminExpense",
      expense.id.toString(),
      body,
      "Expenses",
    );
    return { success: true, data: expense };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update expense (Admin only)" })
  @ApiResponse({ status: 200, description: "Expense updated" })
  async updateExpense(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body()
    body: {
      category?: string;
      amount?: number;
      currency?: string;
      note?: string;
      incurredAt?: string;
    },
  ) {
    this.checkAdminRole(req.user);
    const expense = await this.expensesService.updateExpense(
      id,
      body,
      Number(req.user.id),
    );
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "UPDATE_EXPENSE",
      "AdminExpense",
      id.toString(),
      body,
      "Expenses",
    );
    return { success: true, data: expense };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete expense (Admin only)" })
  @ApiResponse({ status: 200, description: "Expense deleted" })
  async deleteExpense(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
  ) {
    this.checkAdminRole(req.user);
    await this.expensesService.deleteExpense(id);
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "DELETE_EXPENSE",
      "AdminExpense",
      id.toString(),
      null,
      "Expenses",
    );
    return { success: true };
  }
}
