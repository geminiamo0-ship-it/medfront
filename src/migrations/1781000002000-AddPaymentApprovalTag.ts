import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentApprovalTag1781000002000 implements MigrationInterface {
  name = "AddPaymentApprovalTag1781000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "approval_tag" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "approval_note" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "approval_note"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "approval_tag"
    `);
  }
}
