import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Supports the latest-attempt question-status lookup
 * (`getLatestAnsweredStatusIds`), which resolves a user's correct/incorrect
 * status from their NEWEST answered submission per question via:
 *
 *   SELECT DISTINCT ON ("questionId") "questionId", "isCorrect"
 *     FROM question_submissions
 *    WHERE "userId" = $1 AND "selectedOptionId" IS NOT NULL
 *    ORDER BY "questionId", "submittedAt" DESC, "id" DESC
 *
 * A partial composite index on ("userId", "questionId", "submittedAt" DESC)
 * filtered to answered rows turns that query into a pure index scan: the
 * planner walks the index in (questionId, submittedAt DESC) order per user and
 * DISTINCT ON takes the first row of each group with no extra sort. The partial
 * predicate keeps the index small (blank/omitted rows are excluded) and matches
 * the query's WHERE exactly so it stays usable.
 */
export class AddLatestAnsweredStatusIndex1803000000011 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_qsub_user_question_submitted"
            ON "question_submissions" ("userId", "questionId", "submittedAt" DESC)
            WHERE "selectedOptionId" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qsub_user_question_submitted"`);
    }
}
