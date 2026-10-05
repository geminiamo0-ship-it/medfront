import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingPlans1776000007000 implements MigrationInterface {
  name = 'CreatePricingPlans1776000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_plans" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(64) NOT NULL,
        "name" VARCHAR(120) NOT NULL,
        "tier" VARCHAR(20) NOT NULL DEFAULT 'Premium',
        "duration_months" INTEGER NOT NULL,
        "duration_label" VARCHAR(20) NOT NULL,
        "real_price" NUMERIC(10, 2) NOT NULL,
        "discounted_price" NUMERIC(10, 2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
        "benefits" TEXT[] NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "is_featured" BOOLEAN NOT NULL DEFAULT false,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pricing_plans_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "plan_code" VARCHAR(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ADD COLUMN IF NOT EXISTS "plan_name" VARCHAR(120)
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_payments"
      ALTER COLUMN "duration" SET DEFAULT 'yearly'
    `);

    await queryRunner.query(`
      INSERT INTO "pricing_plans" (
        "code",
        "name",
        "tier",
        "duration_months",
        "duration_label",
        "real_price",
        "discounted_price",
        "currency",
        "benefits",
        "is_active",
        "is_featured",
        "display_order"
      )
      VALUES
      (
        'PREMIUM_YEARLY',
        'Yearly Access',
        'Premium',
        12,
        'yearly',
        64,
        47,
        'USD',
        ARRAY[
          'Access to all USMLE Steps',
          'Unlimited practice tests',
          'Detailed explanations',
          'Performance analytics',
          'Priority support'
        ],
        true,
        false,
        1
      ),
      (
        'PREMIUM_LIFETIME',
        'Lifetime Access',
        'Premium',
        1200,
        'lifetime',
        79,
        59,
        'USD',
        ARRAY[
          'Everything in Yearly plan',
          'Lifetime updates',
          'AI Study Assistant',
          'Global contest access'
        ],
        true,
        true,
        2
      )
      ON CONFLICT ("code") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "pending_payments"
      SET "plan_code" = CASE
          WHEN "duration" = 'yearly' THEN 'PREMIUM_YEARLY'
          WHEN "duration" = 'lifetime' THEN 'PREMIUM_LIFETIME'
          ELSE "plan_code"
        END,
        "plan_name" = CASE
          WHEN "duration" = 'yearly' THEN 'Yearly Access'
          WHEN "duration" = 'lifetime' THEN 'Lifetime Access'
          ELSE "plan_name"
        END
      WHERE "plan_code" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "plan_code"`);
    await queryRunner.query(`ALTER TABLE "pending_payments" DROP COLUMN IF EXISTS "plan_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_plans"`);
  }
}
