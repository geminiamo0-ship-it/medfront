import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAffiliateDiscountPercentToUsers1776000009000 implements MigrationInterface {
  name = "AddAffiliateDiscountPercentToUsers1776000009000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "affiliate_discount_percent" integer NOT NULL DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "affiliate_discount_percent"
    `);
  }
}
