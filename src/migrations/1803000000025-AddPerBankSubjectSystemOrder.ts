import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-bank subject/system ORDER + 2-column layout override.
 *
 * Two thin override tables keyed by (question_bank_id, {subject|system}_id).
 * A row pins a subject/system to a column (1 = left, 2 = right) at a 0-based
 * position for ONE bank. Absence of any rows for a bank = global order (the
 * current behaviour). Raw-int columns, no hard FKs — mirrors
 * user_question_marks.
 *
 * SCHEMA ONLY. Data is loaded by src/scripts/seed-uworld-s1-order.ts, kept out
 * of the migration on purpose so re-running the seed can't require a new
 * migration.
 */
export class AddPerBankSubjectSystemOrder1803000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_bank_subject_order" (
        "question_bank_id" integer NOT NULL,
        "subject_id" integer NOT NULL,
        "column_index" smallint NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_question_bank_subject_order"
          PRIMARY KEY ("question_bank_id", "subject_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_bank_subject_order_bank"
      ON "question_bank_subject_order" ("question_bank_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_bank_system_order" (
        "question_bank_id" integer NOT NULL,
        "system_id" integer NOT NULL,
        "column_index" smallint NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_question_bank_system_order"
          PRIMARY KEY ("question_bank_id", "system_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_bank_system_order_bank"
      ON "question_bank_system_order" ("question_bank_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_bank_system_order_bank"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_bank_system_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_bank_subject_order_bank"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_bank_subject_order"`);
  }
}
