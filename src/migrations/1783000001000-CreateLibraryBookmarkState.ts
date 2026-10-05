import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLibraryBookmarkState1783000001000 implements MigrationInterface {
  name = "CreateLibraryBookmarkState1783000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "library_bookmark_state" (
        "id" BIGSERIAL PRIMARY KEY,
        "userId" INT NOT NULL,
        "folders" TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        "assignments" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_library_bookmark_state_user" ON "library_bookmark_state" ("userId")`);
    await queryRunner.query(`
      ALTER TABLE "library_bookmark_state"
      ADD CONSTRAINT "FK_library_bookmark_state_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "library_bookmark_state" DROP CONSTRAINT IF EXISTS "FK_library_bookmark_state_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_library_bookmark_state_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_bookmark_state"`);
  }
}
