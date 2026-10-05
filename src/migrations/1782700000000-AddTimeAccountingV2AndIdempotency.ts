import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mixed-mode time-accounting v2.
 *
 * Adds a single column `tests.time_accounting_version`:
 *   v=1 → wall-clock semantics (legacy + Timed; today's behaviour, unchanged).
 *   v=2 → active-time semantics (new Mixed tests).
 *
 * Branch on this column, NOT on `!!timeLimitSeconds`, so in-flight v=1 tests
 * keep wall-clock and only newly-created Mixed tests switch to active-time.
 *
 * Down: refuses to drop the column if any tests are on v=2, since rolling
 * back would silently re-interpret them under wall-clock rules and break
 * their timer.
 */
export class AddTimeAccountingV2AndIdempotency1782700000000 implements MigrationInterface {
  name = 'AddTimeAccountingV2AndIdempotency1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tests"
        ADD COLUMN IF NOT EXISTS "time_accounting_version" SMALLINT NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const v2Rows: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "tests" WHERE "time_accounting_version" = 2`,
    );
    const v2Count = Number(v2Rows?.[0]?.count ?? 0);
    if (v2Count > 0) {
      throw new Error(
        `Refusing to drop "time_accounting_version": ${v2Count} test(s) are on v=2. ` +
          `Rolling back would corrupt v=2 (active-time) tests by reinterpreting them under ` +
          `v=1 (wall-clock) semantics. Migrate or archive those tests before reverting.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "tests"
        DROP COLUMN IF EXISTS "time_accounting_version"
    `);
  }
}
