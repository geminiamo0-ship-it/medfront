import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePaymentExpiryNullable1776000002000 implements MigrationInterface {
  name = 'MakePaymentExpiryNullable1776000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pending_payments" ALTER COLUMN "expires_at" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pending_payments" ALTER COLUMN "expires_at" SET NOT NULL`);
  }
}
