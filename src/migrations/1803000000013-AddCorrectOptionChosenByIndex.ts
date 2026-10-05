import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial covering index over correct options' uworld_chosen_by.
 *
 * Originally added for a query-time difficulty CASE join; the filter has
 * since moved to the stored, trigger-maintained questions.difficulty column
 * (migration 1803000000014). The index stays because it now serves the
 * trigger's per-row lookup — recompute_question_difficulty() probes
 * question_options by (questionId, isCorrect) and reads uworld_chosen_by on
 * every option write (bulk imports fire it per row) — and any future
 * threshold-change rebackfill scans exactly this subset index-only.
 */
export class AddCorrectOptionChosenByIndex1803000000013 implements MigrationInterface {
  name = 'AddCorrectOptionChosenByIndex1803000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NOTE: plain CREATE INDEX (not CONCURRENTLY — TypeORM runs migrations in
    // a transaction). The build write-locks question_options for its duration:
    // ~1-3s at 500k rows. If the table grows to many millions, create the
    // index manually with CONCURRENTLY during a quiet window instead and let
    // this IF NOT EXISTS no-op.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_options_correct_chosen_by"
      ON "question_options" ("questionId", "uworld_chosen_by")
      WHERE "isCorrect" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_question_options_correct_chosen_by"`,
    );
  }
}
