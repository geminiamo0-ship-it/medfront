import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAmbossLibrary1782000000000 implements MigrationInterface {
  name = "AddAmbossLibrary1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "library_articles"
      ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'usmle'
    `);

    await queryRunner.query(`
      ALTER TABLE "library_articles"
      ADD COLUMN IF NOT EXISTS "external_id" TEXT
    `);

    await queryRunner.query(`
      UPDATE "library_articles"
      SET "source" = 'usmle'
      WHERE "source" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "library_articles_source_external_id_unique"
      ON "library_articles" ("source", "external_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_article_locations" (
        "id" SERIAL PRIMARY KEY,
        "articleId" INT NOT NULL REFERENCES "library_articles"("id") ON DELETE CASCADE,
        "category_path" TEXT NOT NULL,
        UNIQUE ("articleId", "category_path")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_tooltips" (
        "eid" TEXT PRIMARY KEY,
        "abstract" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'amboss'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "library_tooltips"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_article_locations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "library_articles_source_external_id_unique"`);
    await queryRunner.query(`ALTER TABLE "library_articles" DROP COLUMN IF EXISTS "external_id"`);
    await queryRunner.query(`ALTER TABLE "library_articles" DROP COLUMN IF EXISTS "source"`);
  }
}
