import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinanceSettings1803000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "finance_settings" (
        "id" SERIAL PRIMARY KEY,
        "master_currency" VARCHAR(10) NOT NULL DEFAULT 'EGP',
        "usd_to_egp_rate" DECIMAL(10,4) NOT NULL DEFAULT 1,
        "rate_updated_at" TIMESTAMP NULL,
        "updated_by_admin_id" INT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    // Seed a single default row
    await queryRunner.query(`
      INSERT INTO "finance_settings" ("master_currency", "usd_to_egp_rate", "rate_updated_at")
      VALUES ('EGP', 50.0000, now())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "finance_settings"`);
  }
}
