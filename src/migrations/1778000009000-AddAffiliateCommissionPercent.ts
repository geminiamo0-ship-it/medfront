import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAffiliateCommissionPercent1778000009000
  implements MigrationInterface
{
  name = "AddAffiliateCommissionPercent1778000009000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "affiliate_commission_percent" integer DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "affiliate_commission_percent"
    `);
  }
}
