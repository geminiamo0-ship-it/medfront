import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHighlightHtmlCache1802000000002 implements MigrationInterface {
  name = 'AddHighlightHtmlCache1802000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
        ADD COLUMN IF NOT EXISTS "question_html_cache" TEXT NULL,
        ADD COLUMN IF NOT EXISTS "explanation_html_cache" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
        DROP COLUMN IF EXISTS "question_html_cache",
        DROP COLUMN IF EXISTS "explanation_html_cache"
    `);
  }
}
