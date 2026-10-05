import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionNotes1740000013000 implements MigrationInterface {
  name = 'CreateQuestionNotes1740000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_notes" (
        "id"          BIGSERIAL PRIMARY KEY,
        "user_id"     INT        NOT NULL REFERENCES "users"("id")     ON DELETE CASCADE,
        "question_id" INT        NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
        "content"     TEXT       NOT NULL,
        "createdAt"   TIMESTAMP  NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP  NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "question_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_notes"`);
  }
}
