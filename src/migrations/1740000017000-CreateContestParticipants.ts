import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContestParticipants1740000017000 implements MigrationInterface {
  name = 'CreateContestParticipants1740000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "contest_participants_status_enum"
        AS ENUM ('registered', 'ready', 'in_progress', 'completed', 'timed_out', 'disqualified')
    `);

    await queryRunner.query(`
      CREATE TABLE "contest_participants" (
        "id"                     SERIAL PRIMARY KEY,
        "contestId"              INT                                   NOT NULL REFERENCES "contests"("id"),
        "userId"                 INT                                   NOT NULL REFERENCES "users"("id"),
        "status"                 "contest_participants_status_enum"    NOT NULL DEFAULT 'registered',
        "registeredAt"           TIMESTAMP                             NOT NULL,
        "startedAt"              TIMESTAMP,
        "lastActivityAt"         TIMESTAMP,
        "completedAt"            TIMESTAMP,
        "totalScore"             INT                                   NOT NULL DEFAULT 0,
        "correctAnswers"         INT                                   NOT NULL DEFAULT 0,
        "wrongAnswers"           INT                                   NOT NULL DEFAULT 0,
        "unansweredQuestions"    INT                                   NOT NULL DEFAULT 0,
        "timeSpentSeconds"       INT                                   NOT NULL DEFAULT 0,
        "accuracyPercentage"     DECIMAL(5,2)                         NOT NULL DEFAULT 0,
        "rank"                   INT,
        "percentile"             INT,
        "oldRating"              INT,
        "ratingChange"           INT,
        "answers"                JSON,
        "submissionTimes"        JSON,
        "answerSequences"        JSON,
        "pointsEarnedByQuestion" JSON,
        "totalAnswerChanges"     INT                                   NOT NULL DEFAULT 0,
        "rightToWrongChanges"    INT                                   NOT NULL DEFAULT 0,
        "averageTimePerQuestion" DECIMAL(5,2),
        "questionsMarkedForReview" INT                                 NOT NULL DEFAULT 0,
        "performanceBySubject"   JSON,
        "behaviorSummary"        JSON,
        "disqualificationReason" TEXT,
        "disqualifiedAt"         TIMESTAMP,
        "createdAt"              TIMESTAMP                             NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP                             NOT NULL DEFAULT now(),
        UNIQUE ("contestId", "userId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_contest_participants_contestId_status"    ON "contest_participants" ("contestId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_contest_participants_leaderboard"         ON "contest_participants" ("contestId", "totalScore", "timeSpentSeconds")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contest_participants"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contest_participants_status_enum"`);
  }
}
