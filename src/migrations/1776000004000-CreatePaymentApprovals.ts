import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentApprovals1776000004000 implements MigrationInterface {
  name = 'CreatePaymentApprovals1776000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_approvals" (
        "id" SERIAL NOT NULL,
        "payment_id" integer NOT NULL,
        "admin_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_approvals_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_approvals_payment_admin" UNIQUE ("payment_id", "admin_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_approvals"
      ADD CONSTRAINT "FK_payment_approvals_payment"
      FOREIGN KEY ("payment_id") REFERENCES "pending_payments"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_approvals"
      ADD CONSTRAINT "FK_payment_approvals_admin"
      FOREIGN KEY ("admin_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_approvals" DROP CONSTRAINT "FK_payment_approvals_admin"`);
    await queryRunner.query(`ALTER TABLE "payment_approvals" DROP CONSTRAINT "FK_payment_approvals_payment"`);
    await queryRunner.query(`DROP TABLE "payment_approvals"`);
  }
}
