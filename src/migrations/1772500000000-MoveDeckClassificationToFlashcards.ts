import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveDeckClassificationToFlashcards1772500000000
  implements MigrationInterface
{
  name = 'MoveDeckClassificationToFlashcards1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "subjectId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "systemId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "topicId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "color" VARCHAR(7)`,
    );

    await queryRunner.query(`
      UPDATE "flashcards" AS f
      SET
        "subjectId" = d."subjectId",
        "systemId" = d."systemId",
        "topicId" = d."topicId",
        "color" = d."color"
      FROM "flashcard_decks" AS d
      WHERE f."deckId" = d."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD CONSTRAINT "FK_flashcards_subjectId" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD CONSTRAINT "FK_flashcards_systemId" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD CONSTRAINT "FK_flashcards_topicId" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_flashcards_subjectId" ON "flashcards" ("subjectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcards_systemId" ON "flashcards" ("systemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcards_topicId" ON "flashcards" ("topicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flashcards_color" ON "flashcards" ("color")`,
    );

    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" DROP COLUMN IF EXISTS "subjectId" CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" DROP COLUMN IF EXISTS "systemId" CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" DROP COLUMN IF EXISTS "topicId" CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" DROP COLUMN IF EXISTS "color" CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "subjectId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "systemId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "topicId" INT`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_decks" ADD COLUMN IF NOT EXISTS "color" VARCHAR(7) DEFAULT '#3B82F6'`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_flashcards_color"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_flashcards_topicId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_flashcards_systemId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_flashcards_subjectId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP CONSTRAINT IF EXISTS "FK_flashcards_topicId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP CONSTRAINT IF EXISTS "FK_flashcards_systemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP CONSTRAINT IF EXISTS "FK_flashcards_subjectId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "topicId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "systemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "subjectId"`,
    );
  }
}
