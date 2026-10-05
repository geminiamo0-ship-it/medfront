import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContestQuestions1740000018000 implements MigrationInterface {
  name = 'CreateContestQuestions1740000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contest_questions" (
        "id"           SERIAL PRIMARY KEY,
        "contestId"    INT  NOT NULL REFERENCES "contests"("id"),
        "questionId"   INT  NOT NULL REFERENCES "questions"("id"),
        "displayOrder" INT  NOT NULL DEFAULT 0,
        "points"       INT  NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_contest_questions_contestId_order" ON "contest_questions" ("contestId", "displayOrder")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contest_questions"`);
  }
}
