import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdvancedPerformanceAnalytics1772800000000 implements MigrationInterface {
  name = 'AddAdvancedPerformanceAnalytics1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD COLUMN IF NOT EXISTS "blueprintSignature" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD COLUMN IF NOT EXISTS "analyticsProcessedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tests_step_status_completedAt"
      ON "tests" ("step", "status", "completedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tests_blueprintSignature"
      ON "tests" ("blueprintSignature")
    `);

    await queryRunner.query(`
      CREATE TYPE "question_submissions_answer_transition_pattern_enum"
      AS ENUM ('c_to_c', 'c_to_i', 'i_to_c', 'i_to_i', 'unknown')
    `);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      ADD COLUMN IF NOT EXISTS "firstSelectedOptionId" INT
    `);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      ADD COLUMN IF NOT EXISTS "selectionHistory" JSONB
    `);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      ADD COLUMN IF NOT EXISTS "answerTransitionPattern" "question_submissions_answer_transition_pattern_enum" NOT NULL DEFAULT 'unknown'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_submissions_test_transition"
      ON "question_submissions" ("testId", "answerTransitionPattern")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_submissions_user_submittedAt"
      ON "question_submissions" ("userId", "submittedAt")
    `);

    await queryRunner.query(`
      CREATE TYPE "analytics_jobs_job_type_enum"
      AS ENUM ('test_completed')
    `);
    await queryRunner.query(`
      CREATE TYPE "analytics_jobs_status_enum"
      AS ENUM ('pending', 'processing', 'completed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TABLE "analytics_jobs" (
        "id" SERIAL PRIMARY KEY,
        "jobType" "analytics_jobs_job_type_enum" NOT NULL,
        "targetId" INT NOT NULL,
        "status" "analytics_jobs_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" INT NOT NULL DEFAULT 0,
        "nextRunAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lockedAt" TIMESTAMP,
        "lockedBy" VARCHAR(120),
        "payload" JSONB,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_analytics_jobs_job_target_unique"
      ON "analytics_jobs" ("jobType", "targetId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_analytics_jobs_status_nextRunAt"
      ON "analytics_jobs" ("status", "nextRunAt")
    `);

    await queryRunner.query(`
      CREATE TYPE "test_analytics_snapshots_cohort_type_enum"
      AS ENUM ('blueprint', 'step')
    `);
    await queryRunner.query(`
      CREATE TABLE "test_analytics_snapshots" (
        "id" SERIAL PRIMARY KEY,
        "testId" INT NOT NULL,
        "userId" INT NOT NULL,
        "step" INT NOT NULL,
        "totalQuestions" INT NOT NULL,
        "attemptedQuestions" INT NOT NULL,
        "correctQuestions" INT NOT NULL,
        "scorePercentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
        "avgTimeSeconds" DECIMAL(8,2) NOT NULL DEFAULT 0,
        "medianTimeSeconds" DECIMAL(8,2) NOT NULL DEFAULT 0,
        "confidenceScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
        "overthinkingIndex" DECIMAL(8,2) NOT NULL DEFAULT 0,
        "cohortType" "test_analytics_snapshots_cohort_type_enum" NOT NULL,
        "cohortSize" INT NOT NULL DEFAULT 0,
        "percentileRank" INT NOT NULL DEFAULT 0,
        "lowConfidence" BOOLEAN NOT NULL DEFAULT false,
        "transitionCounts" JSONB,
        "timeAccuracyQuadrants" JSONB,
        "difficultyAnalytics" JSONB,
        "fatigueSegments" JSONB,
        "peerComparison" JSONB,
        "weaknessMap" JSONB,
        "insights" JSONB,
        "computedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_test_analytics_snapshots_test"
          FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_test_analytics_snapshots_testId"
      ON "test_analytics_snapshots" ("testId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_test_analytics_snapshots_user_step_computedAt"
      ON "test_analytics_snapshots" ("userId", "step", "computedAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_analytics_stats" (
        "id" SERIAL PRIMARY KEY,
        "userId" INT NOT NULL,
        "step" INT NOT NULL,
        "testsCompleted" INT NOT NULL DEFAULT 0,
        "questionsAttempted" INT NOT NULL DEFAULT 0,
        "correctAnswers" INT NOT NULL DEFAULT 0,
        "totalTimeSeconds" INT NOT NULL DEFAULT 0,
        "cToCCount" INT NOT NULL DEFAULT 0,
        "cToICount" INT NOT NULL DEFAULT 0,
        "iToCCount" INT NOT NULL DEFAULT 0,
        "iToICount" INT NOT NULL DEFAULT 0,
        "fastCorrectCount" INT NOT NULL DEFAULT 0,
        "slowCorrectCount" INT NOT NULL DEFAULT 0,
        "slowIncorrectCount" INT NOT NULL DEFAULT 0,
        "fastIncorrectCount" INT NOT NULL DEFAULT 0,
        "totalConfidenceScore" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "confidenceSamples" INT NOT NULL DEFAULT 0,
        "totalOverthinkingIndex" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "overthinkingSamples" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_analytics_stats_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_analytics_stats_user_step"
      ON "user_analytics_stats" ("userId", "step")
    `);

    await queryRunner.query(`
      CREATE TYPE "user_dimension_stats_dimension_type_enum"
      AS ENUM ('difficulty', 'subject', 'system', 'topic', 'question_bank')
    `);
    await queryRunner.query(`
      CREATE TABLE "user_dimension_stats" (
        "id" SERIAL PRIMARY KEY,
        "userId" INT NOT NULL,
        "step" INT NOT NULL,
        "dimensionType" "user_dimension_stats_dimension_type_enum" NOT NULL,
        "dimensionKey" VARCHAR(120) NOT NULL,
        "dimensionName" VARCHAR(200),
        "attempted" INT NOT NULL DEFAULT 0,
        "correct" INT NOT NULL DEFAULT 0,
        "totalTimeSeconds" INT NOT NULL DEFAULT 0,
        "correctTimeSeconds" INT NOT NULL DEFAULT 0,
        "incorrectTimeSeconds" INT NOT NULL DEFAULT 0,
        "cToICount" INT NOT NULL DEFAULT 0,
        "iToCCount" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_dimension_stats_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_dimension_stats_unique"
      ON "user_dimension_stats" ("userId", "step", "dimensionType", "dimensionKey")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_dimension_stats_user_step_type"
      ON "user_dimension_stats" ("userId", "step", "dimensionType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_dimension_stats_user_step_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_dimension_stats_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_dimension_stats"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_dimension_stats_dimension_type_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_analytics_stats_user_step"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_analytics_stats"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_analytics_snapshots_user_step_computedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_analytics_snapshots_testId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "test_analytics_snapshots"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_analytics_snapshots_cohort_type_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_analytics_jobs_status_nextRunAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_analytics_jobs_job_target_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "analytics_jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "analytics_jobs_job_type_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_submissions_user_submittedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_submissions_test_transition"`);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      DROP COLUMN IF EXISTS "answerTransitionPattern"
    `);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      DROP COLUMN IF EXISTS "selectionHistory"
    `);
    await queryRunner.query(`
      ALTER TABLE "question_submissions"
      DROP COLUMN IF EXISTS "firstSelectedOptionId"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_submissions_answer_transition_pattern_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tests_blueprintSignature"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tests_step_status_completedAt"`);
    await queryRunner.query(`
      ALTER TABLE "tests"
      DROP COLUMN IF EXISTS "analyticsProcessedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "tests"
      DROP COLUMN IF EXISTS "blueprintSignature"
    `);
  }
}
