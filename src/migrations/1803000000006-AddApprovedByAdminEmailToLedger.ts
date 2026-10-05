import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApprovedByAdminEmailToLedger1803000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
        ADD COLUMN IF NOT EXISTS "approved_by_admin_email" VARCHAR(120) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" DROP COLUMN IF EXISTS "approved_by_admin_email"`);
  }
}
