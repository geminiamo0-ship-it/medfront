import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiTables1740000031000 implements MigrationInterface {
  name = "CreateAiTables1740000031000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── ai_usage_logs ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_usage_logs" (
        "id"          BIGSERIAL PRIMARY KEY,
        "userId"      INTEGER       NOT NULL,
        "featureKey"  VARCHAR(64)   NOT NULL,
        "usageDate"   DATE          NOT NULL,
        "callCount"   INTEGER       NOT NULL DEFAULT 0,
        CONSTRAINT "FK_ai_usage_logs_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_ai_usage_logs_user_feature_date"
          UNIQUE ("userId", "featureKey", "usageDate")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_usage_logs_userId" ON "ai_usage_logs" ("userId")
    `);

    // ─── article_ai_summaries ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "article_ai_summaries" (
        "id"          BIGSERIAL PRIMARY KEY,
        "userId"      INTEGER       NOT NULL,
        "articleId"   INTEGER       NOT NULL,
        "content"     TEXT          NOT NULL,
        "createdAt"   TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "FK_article_ai_summaries_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_article_ai_summaries_article"
          FOREIGN KEY ("articleId") REFERENCES "library_articles"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_article_ai_summaries_user_article"
          UNIQUE ("userId", "articleId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_article_ai_summaries_userId"
        ON "article_ai_summaries" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "article_ai_summaries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage_logs"`);
  }
}
