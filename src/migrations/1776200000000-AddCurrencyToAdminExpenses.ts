import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCurrencyToAdminExpenses1776200000000 implements MigrationInterface {
  name = "AddCurrencyToAdminExpenses1776200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_expenses" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NOT NULL DEFAULT 'USD'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_expenses" DROP COLUMN IF EXISTS "currency"`
    );
  }
}
