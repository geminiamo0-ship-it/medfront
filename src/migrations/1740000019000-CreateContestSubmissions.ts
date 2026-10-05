import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContestSubmissions1740000019000 implements MigrationInterface {
  name = 'CreateContestSubmissions1740000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contest_submissions" (
        "id"               SERIAL PRIMARY KEY,
        "participantId"    INT          NOT NULL REFERENCES "contest_participants"("id"),
        "questionId"       INT          NOT NULL REFERENCES "questions"("id"),
        "sessionId"        VARCHAR(36)  NOT NULL,
        "questionNumber"   INT          NOT NULL,
        "selectedOptionId" INT                   REFERENCES "question_options"("id"),
        "isCorrect"        BOOLEAN      NOT NULL,
        "pointsAwarded"    INT          NOT NULL,
        "speedBonus"       INT,
        "timeSpentSeconds" INT          NOT NULL,
        "answerChanges"    INT          NOT NULL DEFAULT 0,
        "answerSequence"   JSON,
        "wasMarked"        BOOLEAN      NOT NULL DEFAULT false,
        "wasReviewed"      BOOLEAN      NOT NULL DEFAULT false,
        "timeInReview"     INT,
        "submittedAt"      TIMESTAMP    NOT NULL,
        "createdAt"        TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_contest_submissions_participantId" ON "contest_submissions" ("participantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_contest_submissions_questionId"    ON "contest_submissions" ("questionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_contest_submissions_submittedAt"   ON "contest_submissions" ("submittedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contest_submissions"`);
  }
}
