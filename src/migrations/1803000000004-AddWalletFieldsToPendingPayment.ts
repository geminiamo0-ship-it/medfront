import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletFieldsToPendingPayment1803000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pending_payments" ADD COLUMN "wallet_id" INT NULL`);
    await queryRunner.query(`ALTER TABLE "pending_payments" ADD COLUMN "commission_amount" DECIMAL(10,2) NULL`);
    await queryRunner.query(`ALTER TABLE "pending_payments" ADD COLUMN "approval_currency" VARCHAR(10) NULL`);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD CONSTRAINT "fk_pp_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP CONSTRAINT "fk_pp_wallet"`);
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP COLUMN "approval_currency"`);
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP COLUMN "commission_amount"`);
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP COLUMN "wallet_id"`);
  }
}
