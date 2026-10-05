import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationReads1781000005000
  implements MigrationInterface
{
  name = "CreateNotificationReads1781000005000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_reads" (
        "id" SERIAL PRIMARY KEY,
        "notification_id" integer NOT NULL,
        "admin_id" integer NOT NULL,
        "read_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_reads_unique"
      ON "notification_reads" ("notification_id", "admin_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_reads_admin_read"
      ON "notification_reads" ("admin_id", "read_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_reads"
      ADD CONSTRAINT "FK_notification_reads_notification"
      FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_reads"
      ADD CONSTRAINT "FK_notification_reads_admin"
      FOREIGN KEY ("admin_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_reads" DROP CONSTRAINT IF EXISTS "FK_notification_reads_admin"
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_reads" DROP CONSTRAINT IF EXISTS "FK_notification_reads_notification"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notification_reads_admin_read"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notification_reads_unique"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "notification_reads"
    `);
  }
}
