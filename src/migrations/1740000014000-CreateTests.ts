import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTests1740000014000 implements MigrationInterface {
  name = 'CreateTests1740000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tests_type_enum"
        AS ENUM ('tutor', 'timed', 'custom')
    `);
    await queryRunner.query(`
      CREATE TYPE "tests_mode_enum"
        AS ENUM ('unused', 'incorrect', 'correct', 'used', 'marked', 'all')
    `);
    await queryRunner.query(`
      CREATE TYPE "tests_status_enum"
        AS ENUM ('in_progress', 'completed', 'abandoned')
    `);

    await queryRunner.query(`
      CREATE TABLE "tests" (
        "id"                  SERIAL PRIMARY KEY,
        "userId"              INT                  NOT NULL REFERENCES "users"("id"),
        "title"               VARCHAR(200)         NOT NULL,
        "type"                "tests_type_enum"    NOT NULL DEFAULT 'tutor',
        "mode"                "tests_mode_enum"    NOT NULL DEFAULT 'all',
        "step"                INT                  NOT NULL,
        "status"              "tests_status_enum"  NOT NULL DEFAULT 'in_progress',
        "filters"             JSON,
        "totalQuestions"      INT                  NOT NULL,
        "answeredQuestions"   INT                  NOT NULL DEFAULT 0,
        "correctAnswers"      INT                  NOT NULL DEFAULT 0,
        "omittedQuestions"    INT                  NOT NULL DEFAULT 0,
        "rightToWrongChanges" INT                  NOT NULL DEFAULT 0,
        "percentageScore"     DECIMAL(5,2),
        "timeSpentSeconds"    INT                  NOT NULL DEFAULT 0,
        "startedAt"           TIMESTAMP            NOT NULL,
        "completedAt"         TIMESTAMP,
        "timeLimitSeconds"    INT,
        "createdAt"           TIMESTAMP            NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP            NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tests_userId_status" ON "tests" ("userId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_tests_completedAt"   ON "tests" ("completedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tests_mode_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tests_type_enum"`);
  }
}
