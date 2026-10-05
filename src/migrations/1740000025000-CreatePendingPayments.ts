import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePendingPayments1740000025000 implements MigrationInterface {
  name = 'CreatePendingPayments1740000025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pending_payments" (
        "id"                SERIAL PRIMARY KEY,
        "user_id"           INT             NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "plan"              VARCHAR(50)     NOT NULL,
        "duration"          VARCHAR(20)     NOT NULL DEFAULT 'monthly',
        "amount"            DECIMAL(10,2)   NOT NULL,
        "currency"          VARCHAR(10)     NOT NULL DEFAULT 'USD',
        "payment_reference" VARCHAR(50)     NOT NULL UNIQUE,
        "telegram_username" VARCHAR(100),
        "status"            VARCHAR(20)     NOT NULL DEFAULT 'pending',
        "proof_image_url"   VARCHAR(500),
        "confirmed_by"      INT,
        "rejection_reason"  TEXT,
        "confirmed_at"      TIMESTAMP,
        "expires_at"        TIMESTAMP       NOT NULL,
        "created_at"        TIMESTAMP       NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP       NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_payments"`);
  }
}
