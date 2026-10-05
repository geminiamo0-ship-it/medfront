import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestions1740000008000 implements MigrationInterface {
  name = 'CreateQuestions1740000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "questions_difficulty_enum"
        AS ENUM ('easy', 'medium', 'hard')
    `);

    await queryRunner.query(`
      CREATE TABLE "questions" (
        "id"                   SERIAL PRIMARY KEY,
        "questionBankId"       INT                         NOT NULL REFERENCES "question_banks"("id") ON DELETE CASCADE,
        "externalId"           VARCHAR(50),
        "textHtml"             TEXT                        NOT NULL,
        "explanationHtml"      TEXT                        NOT NULL,
        "subjectId"            INT                         NOT NULL REFERENCES "subjects"("id"),
        "systemId"             INT                                  REFERENCES "systems"("id"),
        "topicId"              INT                                  REFERENCES "topics"("id"),
        "difficulty"           "questions_difficulty_enum" NOT NULL DEFAULT 'medium',
        "step"                 INT                         NOT NULL,
        "source"               VARCHAR(50)                 NOT NULL,
        "imageUrls"            JSON,
        "videoUrl"             VARCHAR(500),
        "estimatedTimeSeconds" INT                         NOT NULL DEFAULT 90,
        "timesAnswered"        INT                         NOT NULL DEFAULT 0,
        "timesCorrect"         INT                         NOT NULL DEFAULT 0,
        "isActive"             BOOLEAN                     NOT NULL DEFAULT true,
        "parentSetId"          INT,
        "createdAt"            TIMESTAMP                   NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP                   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_questions_questionBankId"      ON "questions" ("questionBankId")`);
    await queryRunner.query(`CREATE INDEX "IDX_questions_subjectId_systemId"  ON "questions" ("subjectId", "systemId")`);
    await queryRunner.query(`CREATE INDEX "IDX_questions_difficulty_step"     ON "questions" ("difficulty", "step")`);
    await queryRunner.query(`CREATE INDEX "IDX_questions_source"              ON "questions" ("source")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "questions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "questions_difficulty_enum"`);
  }
}
