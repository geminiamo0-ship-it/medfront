import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTestQuestions1740000015000 implements MigrationInterface {
  name = 'CreateTestQuestions1740000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "test_questions" (
        "id"           SERIAL PRIMARY KEY,
        "testId"       INT        NOT NULL REFERENCES "tests"("id")     ON DELETE CASCADE,
        "questionId"   INT        NOT NULL REFERENCES "questions"("id"),
        "displayOrder" INT        NOT NULL,
        "createdAt"    TIMESTAMP  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_test_questions_testId"     ON "test_questions" ("testId")`);
    await queryRunner.query(`CREATE INDEX "IDX_test_questions_questionId" ON "test_questions" ("questionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "test_questions"`);
  }
}
