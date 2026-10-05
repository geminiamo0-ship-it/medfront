import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications1781000004000 implements MigrationInterface {
  name = "CreateNotifications1781000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" SERIAL PRIMARY KEY,
        "audience" varchar NOT NULL,
        "user_id" integer,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "type" varchar NOT NULL DEFAULT 'info',
        "metadata" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_audience_read_created"
      ON "notifications" ("audience", "is_read", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_audience_user_created"
      ON "notifications" ("audience", "user_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD CONSTRAINT "FK_notifications_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_user"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notifications_audience_user_created"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notifications_audience_read_created"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "notifications"
    `);
  }
}
