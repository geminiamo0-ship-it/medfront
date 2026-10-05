import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionFeedback1740000012000 implements MigrationInterface {
  name = 'CreateQuestionFeedback1740000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "question_feedback_type_enum"
        AS ENUM ('error', 'clarity', 'suggestion', 'other')
    `);

    await queryRunner.query(`
      CREATE TABLE "question_feedback" (
        "id"         SERIAL PRIMARY KEY,
        "userId"     INT                           NOT NULL REFERENCES "users"("id"),
        "questionId" INT                           NOT NULL REFERENCES "questions"("id"),
        "type"       "question_feedback_type_enum" NOT NULL DEFAULT 'other',
        "comment"    TEXT                          NOT NULL,
        "isResolved" BOOLEAN                       NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMP                     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_question_feedback_questionId" ON "question_feedback" ("questionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_question_feedback_userId"     ON "question_feedback" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_feedback"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_feedback_type_enum"`);
  }
}
