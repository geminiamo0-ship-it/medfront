import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActivityGeoFields1779000011000
  implements MigrationInterface
{
  name = "AddActivityGeoFields1779000011000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "country" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "region" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "city" VARCHAR(128)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_activity_logs"
      ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "latitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "timezone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "city"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "user_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP COLUMN IF EXISTS "ip_address"`,
    );
  }
}
