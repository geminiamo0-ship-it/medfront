import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionSubmissions1740000011000 implements MigrationInterface {
  name = 'CreateQuestionSubmissions1740000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_submissions" (
        "id"                SERIAL PRIMARY KEY,
        "userId"            INT          NOT NULL REFERENCES "users"("id"),
        "questionId"        INT          NOT NULL REFERENCES "questions"("id"),
        "testId"            INT,
        "contestId"         INT,
        "sessionId"         VARCHAR(36)  NOT NULL,
        "selectedOptionId"  INT                   REFERENCES "question_options"("id"),
        "isCorrect"         BOOLEAN      NOT NULL,
        "isMarked"          BOOLEAN      NOT NULL DEFAULT false,
        "timeSpentSeconds"  INT          NOT NULL,
        "answerChanges"     INT          NOT NULL DEFAULT 0,
        "rightToWrongChanges" INT        NOT NULL DEFAULT 0,
        "answerSequence"    JSON,
        "timeToFirstAnswer" INT,
        "timeInReview"      INT,
        "wasGuessed"        BOOLEAN      NOT NULL DEFAULT false,
        "behaviorFlags"     JSON,
        "highlights"        JSON,
        "notes"             TEXT,
        "submittedAt"       TIMESTAMP    NOT NULL,
        "createdAt"         TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    // Composite unique: one submission per question per test OR per contest
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_question_submissions_user_question_test"
        ON "question_submissions" ("userId", "questionId", "testId")
        WHERE "contestId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_question_submissions_user_question_contest"
        ON "question_submissions" ("userId", "questionId", "contestId")
        WHERE "testId" IS NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_question_submissions_testId"      ON "question_submissions" ("testId")`);
    await queryRunner.query(`CREATE INDEX "IDX_question_submissions_contestId"   ON "question_submissions" ("contestId")`);
    await queryRunner.query(`CREATE INDEX "IDX_question_submissions_marked"      ON "question_submissions" ("userId", "isMarked")`);
    await queryRunner.query(`CREATE INDEX "IDX_question_submissions_submittedAt" ON "question_submissions" ("submittedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_submissions"`);
  }
}
