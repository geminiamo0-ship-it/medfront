import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionBanks1740000007000 implements MigrationInterface {
  name = 'CreateQuestionBanks1740000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_banks" (
        "id"             SERIAL PRIMARY KEY,
        "mainBankId"     INT                    REFERENCES "main_banks"("id") ON DELETE SET NULL,
        "name"           VARCHAR(100)  NOT NULL,
        "code"           VARCHAR(50)   NOT NULL UNIQUE,
        "description"    TEXT,
        "step"           INT           NOT NULL,
        "totalQuestions" INT           NOT NULL DEFAULT 0,
        "isPremium"      BOOLEAN       NOT NULL DEFAULT true,
        "icon"           VARCHAR(10),
        "gradient"       VARCHAR(200),
        "isActive"       BOOLEAN       NOT NULL DEFAULT true,
        "displayOrder"   INT           NOT NULL DEFAULT 0,
        "createdAt"      TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_question_banks_code"       ON "question_banks" ("code")`);
    await queryRunner.query(`CREATE INDEX       "IDX_question_banks_mainBankId"  ON "question_banks" ("mainBankId")`);
    await queryRunner.query(`CREATE INDEX       "IDX_question_banks_step"        ON "question_banks" ("step")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_banks"`);
  }
}
