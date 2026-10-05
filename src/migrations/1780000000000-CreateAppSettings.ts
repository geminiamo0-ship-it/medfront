import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppSettings1780000000000 implements MigrationInterface {
  name = 'CreateAppSettings1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "key" VARCHAR(100) NOT NULL,
        "value" TEXT NOT NULL,
        "updated_by" VARCHAR(255),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("key")
      )
    `);

    // Seed the free trial days default
    await queryRunner.query(`
      INSERT INTO "app_settings" ("key", "value", "updated_by")
      VALUES ('FREE_TRIAL_DAYS', '7', 'system')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_settings"`);
  }
}
