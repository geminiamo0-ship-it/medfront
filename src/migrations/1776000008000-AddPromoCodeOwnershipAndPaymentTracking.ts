import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPromoCodeOwnershipAndPaymentTracking1776000008000 implements MigrationInterface {
  name = "AddPromoCodeOwnershipAndPaymentTracking1776000008000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      ADD COLUMN IF NOT EXISTS "owner_user_id" integer
    `);
    await queryRunner
      .query(
        `
      ALTER TABLE "promo_codes"
      ADD CONSTRAINT "FK_promo_codes_owner_user"
      FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_codes_owner_user_id"
      ON "promo_codes" ("owner_user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "promo_code_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "promo_code_owner_user_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "promo_code_value" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "promo_code_discount_percent" integer
    `);
    await queryRunner
      .query(
        `
      ALTER TABLE "pending_payments"
      ADD CONSTRAINT "FK_pending_payments_promo_code"
      FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "pending_payments"
      ADD CONSTRAINT "FK_pending_payments_promo_code_owner_user"
      FOREIGN KEY ("promo_code_owner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pending_payments_promo_code_id"
      ON "pending_payments" ("promo_code_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pending_payments_promo_code_owner_user_id"
      ON "pending_payments" ("promo_code_owner_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pending_payments_promo_code_owner_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pending_payments_promo_code_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP CONSTRAINT IF EXISTS "FK_pending_payments_promo_code_owner_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP CONSTRAINT IF EXISTS "FK_pending_payments_promo_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP COLUMN IF EXISTS "promo_code_discount_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP COLUMN IF EXISTS "promo_code_value"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP COLUMN IF EXISTS "promo_code_owner_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      DROP COLUMN IF EXISTS "promo_code_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_codes_owner_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP CONSTRAINT IF EXISTS "FK_promo_codes_owner_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP COLUMN IF EXISTS "owner_user_id"
    `);
  }
}
