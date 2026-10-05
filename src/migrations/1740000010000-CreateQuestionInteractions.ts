import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionInteractions1740000010000 implements MigrationInterface {
  name = 'CreateQuestionInteractions1740000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "question_interactions_action_type_enum"
        AS ENUM ('view', 'select', 'deselect', 'hover', 'flag', 'unflag', 'submit')
    `);

    await queryRunner.query(`
      CREATE TABLE "question_interactions" (
        "id"               SERIAL PRIMARY KEY,
        "userId"           INT                                          NOT NULL REFERENCES "users"("id"),
        "questionId"       INT                                          NOT NULL REFERENCES "questions"("id"),
        "testId"           INT,
        "contestId"        INT,
        "sessionId"        VARCHAR(36)                                  NOT NULL,
        "selectedOptionId" INT                                                   REFERENCES "question_options"("id"),
        "actionType"       "question_interactions_action_type_enum"     NOT NULL,
        "timeFromStartMs"  INT                                          NOT NULL,
        "metadata"         JSON,
        "createdAt"        TIMESTAMP                                    NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_question_interactions_session"   ON "question_interactions" ("userId", "questionId", "sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_question_interactions_createdAt" ON "question_interactions" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_interactions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_interactions_action_type_enum"`);
  }
}
