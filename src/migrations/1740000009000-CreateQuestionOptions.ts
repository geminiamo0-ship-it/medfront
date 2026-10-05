import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionOptions1740000009000 implements MigrationInterface {
  name = 'CreateQuestionOptions1740000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_options" (
        "id"              SERIAL PRIMARY KEY,
        "questionId"      INT        NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
        "textHtml"        TEXT       NOT NULL,
        "isCorrect"       BOOLEAN    NOT NULL,
        "displayOrder"    CHAR(1)    NOT NULL,
        "explanationHtml" TEXT,
        "createdAt"       TIMESTAMP  NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_question_options_questionId" ON "question_options" ("questionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_options"`);
  }
}
