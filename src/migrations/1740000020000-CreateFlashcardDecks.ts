import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlashcardDecks1740000020000 implements MigrationInterface {
  name = 'CreateFlashcardDecks1740000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "flashcard_decks" (
        "id"          SERIAL PRIMARY KEY,
        "userId"      INT           NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
        "name"        VARCHAR(255)  NOT NULL,
        "description" TEXT,
        "subjectId"   INT                    REFERENCES "subjects"("id") ON DELETE SET NULL,
        "systemId"    INT                    REFERENCES "systems"("id")  ON DELETE SET NULL,
        "topicId"     INT                    REFERENCES "topics"("id")   ON DELETE SET NULL,
        "isPublic"    BOOLEAN                DEFAULT false,
        "color"       VARCHAR(7)             DEFAULT '#3B82F6',
        "cardCount"   INT                    DEFAULT 0,
        "createdAt"   TIMESTAMP              DEFAULT now(),
        "updatedAt"   TIMESTAMP              DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_flashcard_decks_userId"          ON "flashcard_decks" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_flashcard_decks_userId_isPublic" ON "flashcard_decks" ("userId", "isPublic")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flashcard_decks"`);
  }
}
