import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlashcardStats1740000021000 implements MigrationInterface {
  name = 'CreateFlashcardStats1740000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "flashcard_stats" (
        "id"                 SERIAL PRIMARY KEY,
        "userId"             INT        NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "totalCardsCreated"  INT        DEFAULT 0,
        "totalReviews"       INT        DEFAULT 0,
        "currentStreak"      INT        DEFAULT 0,
        "longestStreak"      INT        DEFAULT 0,
        "lastReviewDate"     TIMESTAMP,
        "cardsReviewedToday" INT        DEFAULT 0,
        "totalStudyTimeMs"   INT        DEFAULT 0,
        "updatedAt"          TIMESTAMP  DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flashcard_stats"`);
  }
}
