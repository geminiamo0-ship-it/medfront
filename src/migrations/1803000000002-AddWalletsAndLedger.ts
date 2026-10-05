import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletsAndLedger1803000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(120) NOT NULL,
        "type" VARCHAR(30) NOT NULL DEFAULT 'OTHER',
        "account_number" VARCHAR(255) NULL,
        "base_currency" VARCHAR(10) NOT NULL DEFAULT 'EGP',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_ledger_entries" (
        "id" SERIAL PRIMARY KEY,
        "wallet_id" INT NOT NULL,
        "payment_id" INT NOT NULL,
        "amount" DECIMAL(10,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL,
        "commission_amount" DECIMAL(10,2) NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wle_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_wle_payment" FOREIGN KEY ("payment_id") REFERENCES "pending_payments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_wle_wallet_id" ON "wallet_ledger_entries"("wallet_id")`);
    await queryRunner.query(`CREATE INDEX "idx_wle_payment_id" ON "wallet_ledger_entries"("payment_id")`);
    await queryRunner.query(`CREATE INDEX "idx_wle_created_at" ON "wallet_ledger_entries"("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wallet_ledger_entries"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
