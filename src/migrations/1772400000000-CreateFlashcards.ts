import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlashcards1772400000000 implements MigrationInterface {
  name = 'CreateFlashcards1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "flashcards" (
        "id"             SERIAL PRIMARY KEY,
        "userId"         INT         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "deckId"         INT         NOT NULL REFERENCES "flashcard_decks"("id") ON DELETE CASCADE,
        "questionId"     INT                  REFERENCES "questions"("id") ON DELETE SET NULL,
        "frontContent"   JSONB       NOT NULL DEFAULT '[]'::jsonb,
        "backContent"    JSONB       NOT NULL DEFAULT '[]'::jsonb,
        "frontPlainText" TEXT,
        "backPlainText"  TEXT,
        "isMarked"       BOOLEAN     NOT NULL DEFAULT false,
        "markColor"      VARCHAR(7),
        "rating"         INT,
        "createdAt"      TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_flashcards_rating" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_flashcards_userId" ON "flashcards" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_deckId" ON "flashcards" ("deckId")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_questionId" ON "flashcards" ("questionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_markColor" ON "flashcards" ("markColor")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_rating" ON "flashcards" ("rating")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_userId_deckId" ON "flashcards" ("userId", "deckId")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcards_userId_questionId" ON "flashcards" ("userId", "questionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flashcards"`);
  }
}
