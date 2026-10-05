import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserActivityLogs1779000010000
  implements MigrationInterface
{
  name = "CreateUserActivityLogs1779000010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_activity_logs" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "feature" VARCHAR(64) NOT NULL,
        "action" VARCHAR(64) NOT NULL,
        "entity_type" VARCHAR(64),
        "entity_id" VARCHAR(64),
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_activity_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_activity_user_created"
      ON "user_activity_logs" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_activity_feature"
      ON "user_activity_logs" ("feature")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_activity_action"
      ON "user_activity_logs" ("action")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_activity_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_activity_feature"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_activity_user_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_activity_logs"`);
  }
}
