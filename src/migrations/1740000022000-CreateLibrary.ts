import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLibrary1740000022000 implements MigrationInterface {
  name = 'CreateLibrary1740000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Library articles (no dependencies)
    await queryRunner.query(`
      CREATE TABLE "library_articles" (
        "id"           SERIAL PRIMARY KEY,
        "name"         VARCHAR(255)  NOT NULL,
        "category"     VARCHAR(255)  NOT NULL,
        "content_html" TEXT          NOT NULL,
        "qbank"        VARCHAR(255),
        "created_at"   TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    // User highlights on articles
    await queryRunner.query(`
      CREATE TABLE "article_highlights" (
        "id"          BIGSERIAL PRIMARY KEY,
        "text"        TEXT          NOT NULL,
        "annotation"  TEXT,
        "color"       VARCHAR(255)  NOT NULL DEFAULT 'yellow',
        "rangeIndex"  INT,
        "userId"      INT           NOT NULL REFERENCES "users"("id")            ON DELETE CASCADE,
        "articleId"   INT           NOT NULL REFERENCES "library_articles"("id") ON DELETE CASCADE,
        "createdAt"   TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    // Per-user reading progress
    await queryRunner.query(`
      CREATE TABLE "article_progress" (
        "id"             BIGSERIAL PRIMARY KEY,
        "userId"         INT        NOT NULL REFERENCES "users"("id")            ON DELETE CASCADE,
        "articleId"      INT        NOT NULL REFERENCES "library_articles"("id") ON DELETE CASCADE,
        "isRead"         BOOLEAN    NOT NULL DEFAULT false,
        "isBookmarked"   BOOLEAN    NOT NULL DEFAULT false,
        "lastAccessedAt" TIMESTAMP,
        "updatedAt"      TIMESTAMP  NOT NULL DEFAULT now(),
        UNIQUE ("userId", "articleId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "article_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "article_highlights"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_articles"`);
  }
}
