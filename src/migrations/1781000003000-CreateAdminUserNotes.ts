import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAdminUserNotes1781000003000
  implements MigrationInterface
{
  name = "CreateAdminUserNotes1781000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_user_notes" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL,
        "admin_id" integer,
        "note" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_user_notes_user_created"
      ON "admin_user_notes" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_user_notes"
      ADD CONSTRAINT "FK_admin_user_notes_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_user_notes"
      ADD CONSTRAINT "FK_admin_user_notes_admin"
      FOREIGN KEY ("admin_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_user_notes" DROP CONSTRAINT IF EXISTS "FK_admin_user_notes_admin"
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_user_notes" DROP CONSTRAINT IF EXISTS "FK_admin_user_notes_user"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_admin_user_notes_user_created"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "admin_user_notes"
    `);
  }
}
