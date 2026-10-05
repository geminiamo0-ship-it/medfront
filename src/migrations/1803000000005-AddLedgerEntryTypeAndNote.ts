import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLedgerEntryTypeAndNote1803000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make payment_id nullable (existing rows keep their value)
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "payment_id" DROP NOT NULL`);

    // Drop the old FK that was NOT NULL-enforced, recreate as nullable
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
        DROP CONSTRAINT IF EXISTS "FK_wallet_ledger_entries_payment_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
        ADD CONSTRAINT "FK_wallet_ledger_entries_payment_id"
        FOREIGN KEY ("payment_id") REFERENCES "pending_payments"("id") ON DELETE SET NULL
    `);

    // Add entry_type column with default PAYMENT
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
        ADD COLUMN IF NOT EXISTS "entry_type" VARCHAR(32) NOT NULL DEFAULT 'PAYMENT'
    `);

    // Add note column
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
        ADD COLUMN IF NOT EXISTS "note" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" DROP COLUMN IF EXISTS "note"`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" DROP COLUMN IF EXISTS "entry_type"`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "payment_id" SET NOT NULL`);
  }
}
