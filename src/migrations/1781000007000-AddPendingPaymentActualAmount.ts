import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingPaymentActualAmount1781000007000
  implements MigrationInterface
{
  name = "AddPendingPaymentActualAmount1781000007000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "actual_amount" DECIMAL(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "actual_amount_note" text
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "actual_amount_updated_by" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "actual_amount_updated_at" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "actual_amount_updated_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "actual_amount_updated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "actual_amount_note"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "actual_amount"
    `);
  }
}
