import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContests1740000016000 implements MigrationInterface {
  name = 'CreateContests1740000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "contests_status_enum"
        AS ENUM ('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TYPE "contests_type_enum"
        AS ENUM ('speed', 'accuracy', 'balanced')
    `);

    await queryRunner.query(`
      CREATE TABLE "contests" (
        "id"                   SERIAL PRIMARY KEY,
        "title"                VARCHAR(200)           NOT NULL,
        "description"          TEXT                   NOT NULL,
        "step"                 INT                    NOT NULL,
        "type"                 "contests_type_enum"   NOT NULL DEFAULT 'balanced',
        "totalQuestions"       INT                    NOT NULL,
        "durationMinutes"      INT                    NOT NULL,
        "registrationOpenTime" TIMESTAMP              NOT NULL,
        "registrationDeadline" TIMESTAMP              NOT NULL,
        "startTime"            TIMESTAMP              NOT NULL,
        "endTime"              TIMESTAMP              NOT NULL,
        "status"               "contests_status_enum" NOT NULL DEFAULT 'draft',
        "maxParticipants"      INT,
        "currentParticipants"  INT                    NOT NULL DEFAULT 0,
        "isPremium"            BOOLEAN                NOT NULL DEFAULT false,
        "prizeDescription"     TEXT,
        "bannerUrl"            VARCHAR(500),
        "rules"                JSON,
        "scoring"              JSON,
        "resultsCalculated"    BOOLEAN                NOT NULL DEFAULT false,
        "isActive"             BOOLEAN                NOT NULL DEFAULT true,
        "createdAt"            TIMESTAMP              NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP              NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_contests_status_startTime" ON "contests" ("status", "startTime")`);
    await queryRunner.query(`CREATE INDEX "IDX_contests_step"             ON "contests" ("step")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contests_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contests_status_enum"`);
  }
}
