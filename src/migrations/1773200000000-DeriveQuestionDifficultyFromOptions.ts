import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeriveQuestionDifficultyFromOptions1773200000000 implements MigrationInterface {
  name = 'DeriveQuestionDifficultyFromOptions1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_questions_difficulty_step"`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN IF EXISTS "difficulty"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "questions_difficulty_enum"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_questions_step_is_active" ON "questions" ("step", "isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'questions_difficulty_enum'
        ) THEN
          CREATE TYPE "questions_difficulty_enum" AS ENUM ('easy', 'medium', 'hard');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN IF NOT EXISTS "difficulty" "questions_difficulty_enum" NOT NULL DEFAULT 'medium'
    `);

    await queryRunner.query(`
      UPDATE "questions" AS q
      SET "difficulty" = CASE
        WHEN correct_option."uworld_chosen_by" IS NULL THEN 'medium'::"questions_difficulty_enum"
        WHEN correct_option."uworld_chosen_by" > 80 THEN 'easy'::"questions_difficulty_enum"
        WHEN correct_option."uworld_chosen_by" >= 50 THEN 'medium'::"questions_difficulty_enum"
        ELSE 'hard'::"questions_difficulty_enum"
      END
      FROM "question_options" AS correct_option
      WHERE correct_option."questionId" = q."id"
        AND correct_option."isCorrect" = true
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_questions_step_is_active"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_questions_difficulty_step" ON "questions" ("difficulty", "step")`,
    );
  }
}
