import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stored, trigger-maintained question difficulty.
 *
 * Adds questions.difficulty (varchar, nullable) holding the 5-tier bucket of
 * the CORRECT option's uworld_chosen_by:
 *   very_hard [0,30) · hard [30,50) · medium [50,65) · easy [65,75) ·
 *   very_easy [75,100] · NULL = no UWorld data / no correct option.
 *
 * Maintenance is a DATABASE TRIGGER on question_options — not app code — so
 * every write path keeps the column in sync automatically: bulk import
 * upserts (raw SQL), the admin option editor, and anything written in the
 * future. There is no drift window and no recompute script to remember.
 *
 * The backfill runs here in the same migration: one UPDATE...FROM pass over
 * the existing rows (~seconds at 500k options). New questions are covered by
 * the trigger the moment their options are inserted.
 *
 * The bucket thresholds live in recompute_question_difficulty() below — the
 * single source of truth. Changing tiers later = new migration that replaces
 * the function and re-runs the backfill UPDATE.
 */
export class AddQuestionDifficultyColumn1803000000014 implements MigrationInterface {
  name = 'AddQuestionDifficultyColumn1803000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "difficulty" varchar(12)`,
    );

    // Partial index: difficulty IN (...) filters skip NULL rows by
    // definition, so indexing only non-null values keeps it small.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_difficulty"
      ON "questions" ("difficulty")
      WHERE "difficulty" IS NOT NULL
    `);

    // Single source of truth for the bucket math.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recompute_question_difficulty(qid int)
      RETURNS void AS $$
      DECLARE
        rate int;
      BEGIN
        SELECT o."uworld_chosen_by" INTO rate
          FROM "question_options" o
         WHERE o."questionId" = qid AND o."isCorrect" = true
         ORDER BY o."id"
         LIMIT 1;

        UPDATE "questions" SET "difficulty" =
          CASE
            WHEN rate IS NULL THEN NULL
            WHEN rate >= 75 THEN 'very_easy'
            WHEN rate >= 65 THEN 'easy'
            WHEN rate >= 50 THEN 'medium'
            WHEN rate >= 30 THEN 'hard'
            ELSE 'very_hard'
          END
        WHERE "id" = qid;
      END
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION question_options_difficulty_sync()
      RETURNS trigger AS $$
      BEGIN
        -- Recompute the affected parent question. On the (theoretical) move
        -- of an option between questions, recompute both sides.
        IF TG_OP = 'DELETE' THEN
          PERFORM recompute_question_difficulty(OLD."questionId");
        ELSE
          PERFORM recompute_question_difficulty(NEW."questionId");
          IF TG_OP = 'UPDATE' AND NEW."questionId" IS DISTINCT FROM OLD."questionId" THEN
            PERFORM recompute_question_difficulty(OLD."questionId");
          END IF;
        END IF;
        RETURN NULL;
      END
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_question_options_difficulty ON "question_options"`,
    );
    // Fires only on writes that can change the derived value: option
    // inserts/deletes, correctness flips, and chosen-by edits.
    await queryRunner.query(`
      CREATE TRIGGER trg_question_options_difficulty
      AFTER INSERT OR DELETE OR UPDATE OF "uworld_chosen_by", "isCorrect", "questionId"
      ON "question_options"
      FOR EACH ROW
      EXECUTE FUNCTION question_options_difficulty_sync()
    `);

    // Backfill every existing question in one pass. Questions without a
    // correct option (or with NULL chosen-by) stay NULL by design.
    await queryRunner.query(`
      UPDATE "questions" q SET "difficulty" = sub.tier
      FROM (
        SELECT DISTINCT ON (o."questionId")
               o."questionId" AS qid,
               CASE
                 WHEN o."uworld_chosen_by" IS NULL THEN NULL
                 WHEN o."uworld_chosen_by" >= 75 THEN 'very_easy'
                 WHEN o."uworld_chosen_by" >= 65 THEN 'easy'
                 WHEN o."uworld_chosen_by" >= 50 THEN 'medium'
                 WHEN o."uworld_chosen_by" >= 30 THEN 'hard'
                 ELSE 'very_hard'
               END AS tier
          FROM "question_options" o
         WHERE o."isCorrect" = true
         ORDER BY o."questionId", o."id"
      ) sub
      WHERE q."id" = sub.qid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_question_options_difficulty ON "question_options"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS question_options_difficulty_sync()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS recompute_question_difficulty(int)`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_questions_difficulty"`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN IF EXISTS "difficulty"`);
  }
}
