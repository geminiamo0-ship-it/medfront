import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * One-time backfill: copy every existing "marked for review" flag from the
 * legacy QuestionSubmission.isMarked column into the dedicated
 * user_question_marks table so historical marks remain visible under the
 * new flow.
 *
 * Why a separate migration (not bundled with the table creation):
 *   - Keeps the two concerns rollback-able independently. If the new flow
 *     misbehaves and we revert the code, the empty table is harmless. The
 *     backfill is only useful once the new code is reading from the table.
 *   - Allows running 1803000000007 immediately, then deferring the backfill
 *     until the user confirms the new flow works.
 *
 * Safety properties:
 *   - Idempotent: ON CONFLICT DO NOTHING means marks already inserted via
 *     PATCH /tests/:id/mark between the table-create migration and this
 *     backfill are preserved untouched.
 *   - Dedup: a single (user, question) pair may have isMarked=true in
 *     multiple submission rows (same question appearing in multiple tests).
 *     GROUP BY collapses to one row per pair, matching the new table's PK.
 *   - Cheap to scan: WHERE "isMarked" = true uses the existing
 *     ("userId", "isMarked") index on question_submissions, so the planner
 *     never has to read non-marked rows.
 *   - Earliest-mark timestamp: MIN("submittedAt") preserves a meaningful
 *     marked_at value rather than slamming everything to now().
 */
export class BackfillUserQuestionMarks1803000000008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Pre-flight counts (operational visibility) ────────────────────
        const sourceRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count
            FROM (
                SELECT 1
                FROM question_submissions
                WHERE "isMarked" = true
                GROUP BY "userId", "questionId"
            ) sq
        `);
        const expectedInserts = Number(sourceRows?.[0]?.count ?? 0);

        const beforeRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count FROM user_question_marks
        `);
        const beforeCount = Number(beforeRows?.[0]?.count ?? 0);

        console.log(
            `[BackfillUserQuestionMarks] expecting up to ${expectedInserts} ` +
            `dedup'd marks from question_submissions; ` +
            `user_question_marks currently has ${beforeCount} rows.`,
        );

        // ── The backfill itself ───────────────────────────────────────────
        // One statement, fully transactional. Each row is a PK insert that
        // either takes (new pair) or is skipped (already present from the
        // live PATCH endpoint).
        await queryRunner.query(`
            INSERT INTO user_question_marks (user_id, question_id, marked_at)
            SELECT
                "userId"                AS user_id,
                "questionId"            AS question_id,
                MIN("submittedAt")      AS marked_at
            FROM question_submissions
            WHERE "isMarked" = true
            GROUP BY "userId", "questionId"
            ON CONFLICT (user_id, question_id) DO NOTHING
        `);

        // ── Post-flight verification ──────────────────────────────────────
        const afterRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count FROM user_question_marks
        `);
        const afterCount = Number(afterRows?.[0]?.count ?? 0);
        const inserted = afterCount - beforeCount;

        console.log(
            `[BackfillUserQuestionMarks] inserted ${inserted} new rows ` +
            `(skipped ${Math.max(0, expectedInserts - inserted)} via ` +
            `ON CONFLICT). user_question_marks now has ${afterCount} rows.`,
        );

        // Sanity check: after the backfill, the destination should contain
        // at least every (user, question) pair that the source has flagged.
        // It can legitimately contain MORE (rows added via the new endpoint
        // for questions that have no submission yet).
        if (afterCount < expectedInserts) {
            throw new Error(
                `[BackfillUserQuestionMarks] post-backfill row count ` +
                `(${afterCount}) is lower than the expected source count ` +
                `(${expectedInserts}). Aborting — investigate before retrying.`,
            );
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Intentional no-op.
        //
        // We cannot safely identify which rows in user_question_marks came
        // from this backfill vs. ones created by the live PATCH endpoint
        // after the backfill ran. Deleting all of them would destroy real
        // user data; deleting none risks leaving stale data — but stale
        // data is harmless because the new code is the only reader.
        //
        // If you need to fully undo, revert migration 1803000000007
        // (CreateUserQuestionMarks) instead, which drops the whole table.
    }
}
