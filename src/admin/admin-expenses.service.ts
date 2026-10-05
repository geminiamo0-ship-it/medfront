import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminExpense } from "../entities/admin-expense.entity";

export const SUPPORTED_CURRENCIES = ["USD", "EGP"];

@Injectable()
export class AdminExpensesService {
  constructor(
    @InjectRepository(AdminExpense)
    private readonly expensesRepo: Repository<AdminExpense>,
  ) {}

  async getExpenses(params: {
    limit: number;
    offset: number;
    search?: string;
    category?: string;
    currency?: string;
    from?: string;
    to?: string;
  }) {
    const { limit, offset, search, category, currency, from, to } = params;
    const query = this.expensesRepo
      .createQueryBuilder("expense")
      .where("1=1");

    const applyFilters = (qb: any) => {
      if (search) {
        qb.andWhere(
          "(expense.category ILIKE :term OR expense.note ILIKE :term)",
          { term: `%${search}%` },
        );
      }

      if (category) {
        qb.andWhere("LOWER(expense.category) = :category", {
          category: category.toLowerCase().trim(),
        });
      }

      if (currency) {
        qb.andWhere("UPPER(expense.currency) = :currency", {
          currency: currency.toUpperCase().trim(),
        });
      }

      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          throw new BadRequestException("Invalid from date");
        }
        qb.andWhere("expense.incurred_at >= :from", { from: fromDate });
      }

      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          throw new BadRequestException("Invalid to date");
        }
        qb.andWhere("expense.incurred_at <= :to", { to: toDate });
      }
    };

    applyFilters(query);

    query
      .orderBy("expense.incurred_at", "DESC")
      .addOrderBy("expense.created_at", "DESC")
      .skip(offset)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    // Per-currency totals
    const totalsQuery = this.expensesRepo
      .createQueryBuilder("expense")
      .select("UPPER(expense.currency)", "currency")
      .addSelect("SUM(expense.amount)", "total")
      .where("1=1")
      .groupBy("UPPER(expense.currency)");
    applyFilters(totalsQuery);
    const totalsRaw = await totalsQuery.getRawMany<{ currency: string; total: string }>();
    const totalsPerCurrency = totalsRaw.map((row) => ({
      currency: row.currency || "USD",
      total: Number(row.total || 0),
    }));

    // Backward-compat flat total (USD equivalent — just sum all for legacy)
    const totalAmount = totalsPerCurrency.reduce((acc, c) => acc + c.total, 0);

    const categories = await this.expensesRepo
      .createQueryBuilder("expense")
      .select("DISTINCT expense.category", "category")
      .orderBy("expense.category", "ASC")
      .getRawMany<{ category: string }>();

    return {
      success: true,
      data,
      total,
      limit,
      offset,
      totalAmount,
      totalsPerCurrency,
      categories: categories.map((item) => item.category),
    };
  }

  async createExpense(
    payload: {
      category: string;
      amount: number;
      currency?: string;
      note?: string;
      incurredAt?: string;
    },
    adminId: number,
  ) {
    const category = payload.category?.trim();
    if (!category) {
      throw new BadRequestException("Category is required");
    }
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
      throw new BadRequestException("Amount must be a positive number");
    }

    const currency = (payload.currency?.trim().toUpperCase()) || "USD";

    const incurredAt = payload.incurredAt
      ? new Date(payload.incurredAt)
      : new Date();

    if (Number.isNaN(incurredAt.getTime())) {
      throw new BadRequestException("Invalid incurred date");
    }

    const expense = this.expensesRepo.create({
      category,
      amount: Number(payload.amount.toFixed(2)),
      currency,
      note: payload.note?.trim() || null,
      incurredAt,
      createdBy: adminId || null,
      updatedBy: adminId || null,
    });

    return this.expensesRepo.save(expense);
  }

  async updateExpense(
    id: number,
    payload: {
      category?: string;
      amount?: number;
      currency?: string;
      note?: string;
      incurredAt?: string;
    },
    adminId: number,
  ) {
    const expense = await this.expensesRepo.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException("Expense not found");
    }

    if (payload.category !== undefined) {
      const category = payload.category.trim();
      if (!category) {
        throw new BadRequestException("Category is required");
      }
      expense.category = category;
    }

    if (payload.amount !== undefined) {
      if (!Number.isFinite(payload.amount) || payload.amount < 0) {
        throw new BadRequestException("Amount must be a positive number");
      }
      expense.amount = Number(payload.amount.toFixed(2));
    }

    if (payload.currency !== undefined) {
      expense.currency = payload.currency.trim().toUpperCase() || "USD";
    }

    if (payload.note !== undefined) {
      expense.note = payload.note?.trim() || null;
    }

    if (payload.incurredAt !== undefined) {
      const incurredAt = payload.incurredAt
        ? new Date(payload.incurredAt)
        : new Date();
      if (Number.isNaN(incurredAt.getTime())) {
        throw new BadRequestException("Invalid incurred date");
      }
      expense.incurredAt = incurredAt;
    }

    expense.updatedBy = adminId || null;
    return this.expensesRepo.save(expense);
  }

  async deleteExpense(id: number) {
    const expense = await this.expensesRepo.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException("Expense not found");
    }
    await this.expensesRepo.remove(expense);
    return { success: true };
  }
}
