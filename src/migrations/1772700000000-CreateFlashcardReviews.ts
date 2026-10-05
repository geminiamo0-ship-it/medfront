import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFlashcardReviews1772700000000 implements MigrationInterface {
  name = "CreateFlashcardReviews1772700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "flashcard_reviews" (
        "id"              SERIAL PRIMARY KEY,
        "userId"          INT                NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "cardId"          INT                NOT NULL REFERENCES "flashcards"("id") ON DELETE CASCADE,
        "state"           VARCHAR(16)        NOT NULL DEFAULT 'new',
        "dueAt"           TIMESTAMP,
        "buriedUntil"     TIMESTAMP,
        "lastReviewedAt"  TIMESTAMP,
        "lastRating"      VARCHAR(16),
        "intervalDays"    INT                NOT NULL DEFAULT 0,
        "easeFactor"      DOUBLE PRECISION   NOT NULL DEFAULT 2.5,
        "learningStep"    INT                NOT NULL DEFAULT 0,
        "reps"            INT                NOT NULL DEFAULT 0,
        "lapses"          INT                NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMP          NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP          NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_flashcard_reviews_userId_cardId" UNIQUE ("userId", "cardId"),
        CONSTRAINT "CHK_flashcard_reviews_state" CHECK ("state" IN ('new', 'learning', 'review', 'suspended')),
        CONSTRAINT "CHK_flashcard_reviews_lastRating" CHECK ("lastRating" IS NULL OR "lastRating" IN ('again', 'hard', 'good', 'easy')),
        CONSTRAINT "CHK_flashcard_reviews_intervalDays" CHECK ("intervalDays" >= 0),
        CONSTRAINT "CHK_flashcard_reviews_learningStep" CHECK ("learningStep" >= 0),
        CONSTRAINT "CHK_flashcard_reviews_reps" CHECK ("reps" >= 0),
        CONSTRAINT "CHK_flashcard_reviews_lapses" CHECK ("lapses" >= 0),
        CONSTRAINT "CHK_flashcard_reviews_easeFactor" CHECK ("easeFactor" >= 1.3)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_flashcard_reviews_userId" ON "flashcard_reviews" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcard_reviews_cardId" ON "flashcard_reviews" ("cardId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcard_reviews_userId_state" ON "flashcard_reviews" ("userId", "state")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcard_reviews_userId_dueAt" ON "flashcard_reviews" ("userId", "dueAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcard_reviews_userId_buriedUntil" ON "flashcard_reviews" ("userId", "buriedUntil")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flashcard_reviews"`);
  }
}
