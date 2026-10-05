import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAffiliateProgram1740000030000 implements MigrationInterface {
  name = 'AddAffiliateProgram1740000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add affiliate columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "affiliate_code"       VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS "referred_by_user_id"  INT REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "applied_referral_code" VARCHAR(20)
    `);

    // Create affiliate_referrals table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
        "id"                SERIAL PRIMARY KEY,
        "referrer_id"       INT          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "referred_user_id"  INT          NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "has_paid"          BOOLEAN      NOT NULL DEFAULT false,
        "commission_amount" DECIMAL(10,2),
        "paid_at"           TIMESTAMP,
        "created_at"        TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    // Indexes for fast lookups
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_referrals_referrer_id" ON "affiliate_referrals" ("referrer_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_affiliate_code" ON "users" ("affiliate_code") WHERE "affiliate_code" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate_referrals"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "applied_referral_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "affiliate_code"`);
  }
}
