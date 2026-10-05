import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayrollTables1803000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payroll_employees" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(120) NOT NULL,
        "role" VARCHAR(120) NOT NULL,
        "fixed_monthly_salary" DECIMAL(10,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'EGP',
        "month" INT NOT NULL,
        "year" INT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_expenses" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(30) NOT NULL DEFAULT 'OTHER',
        "amount" DECIMAL(10,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'EGP',
        "month" INT NOT NULL,
        "year" INT NOT NULL,
        "is_template" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "finance_partners" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(120) NOT NULL,
        "equity_percent" DECIMAL(5,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_runs" (
        "id" SERIAL PRIMARY KEY,
        "total_distributed" DECIMAL(10,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'EGP',
        "salaried_this_month" BOOLEAN NOT NULL DEFAULT false,
        "expenses_deducted_this_month" BOOLEAN NOT NULL DEFAULT false,
        "admin_id" INT NOT NULL,
        "admin_email" VARCHAR(120) NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_run_wallet_deductions" (
        "id" SERIAL PRIMARY KEY,
        "payroll_run_id" INT NOT NULL,
        "wallet_id" INT NOT NULL,
        "wallet_name_snapshot" VARCHAR(120) NULL,
        "amount" DECIMAL(10,2) NOT NULL,
        CONSTRAINT "fk_prwd_run" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_prwd_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_run_partner_allocations" (
        "id" SERIAL PRIMARY KEY,
        "payroll_run_id" INT NOT NULL,
        "partner_id" INT NOT NULL,
        "partner_name_snapshot" VARCHAR(120) NULL,
        "equity_percent_snapshot" DECIMAL(5,2) NOT NULL,
        "amount" DECIMAL(10,2) NOT NULL,
        CONSTRAINT "fk_prpa_run" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_prpa_partner" FOREIGN KEY ("partner_id") REFERENCES "finance_partners"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_pe_month_year" ON "payroll_employees"("year", "month")`);
    await queryRunner.query(`CREATE INDEX "idx_pexp_month_year" ON "payroll_expenses"("year", "month")`);
    await queryRunner.query(`CREATE INDEX "idx_pr_created_at" ON "payroll_runs"("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payroll_run_partner_allocations"`);
    await queryRunner.query(`DROP TABLE "payroll_run_wallet_deductions"`);
    await queryRunner.query(`DROP TABLE "payroll_runs"`);
    await queryRunner.query(`DROP TABLE "finance_partners"`);
    await queryRunner.query(`DROP TABLE "payroll_expenses"`);
    await queryRunner.query(`DROP TABLE "payroll_employees"`);
  }
}
