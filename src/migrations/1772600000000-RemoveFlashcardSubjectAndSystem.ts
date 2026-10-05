import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveFlashcardSubjectAndSystem1772600000000
  implements MigrationInterface
{
  name = 'RemoveFlashcardSubjectAndSystem1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_flashcards_topicId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_flashcards_systemId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_flashcards_subjectId"`);

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
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "topicId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "systemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "subjectId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
