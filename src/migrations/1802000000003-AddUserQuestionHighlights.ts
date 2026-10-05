import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserQuestionHighlights1802000000003 implements MigrationInterface {
  name = 'AddUserQuestionHighlights1802000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the isolated highlights table
    await queryRunner.query(`
      CREATE TABLE "user_question_highlights" (
        "id"                    SERIAL      NOT NULL,
        "user_id"               INT         NOT NULL,
        "test_id"               INT         NOT NULL,
        "question_id"           INT         NOT NULL,
        "highlights"            JSON,
        "question_html_cache"   TEXT,
        "explanation_html_cache" TEXT,
        "updated_at"            TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_question_highlights" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_uqh_user_test_question"
        ON "user_question_highlights" ("user_id", "test_id", "question_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_uqh_test"
        ON "user_question_highlights" ("test_id")
    `);

    // Remove the html-cache columns we temporarily added to question_submissions
    // (they belong here now, not there)
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
        DROP COLUMN IF EXISTS "question_html_cache",
        DROP COLUMN IF EXISTS "explanation_html_cache"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_uqh_test"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_uqh_user_test_question"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_question_highlights"`);

    await queryRunner.query(`
      ALTER TABLE "question_submissions"
        ADD COLUMN IF NOT EXISTS "question_html_cache" TEXT NULL,
        ADD COLUMN IF NOT EXISTS "explanation_html_cache" TEXT NULL
    `);
  }
}
