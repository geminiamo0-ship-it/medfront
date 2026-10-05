import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-user-per-question "marked for review" flag, stored independently of
 * QuestionSubmission so a mark can be saved the moment the user clicks the
 * flag — no fake omitted-submission row needed.
 *
 * Existence of a row = marked. Unmarking deletes the row. The PK is the only
 * index needed: filter queries do `EXISTS (SELECT 1 ... WHERE user_id = ? AND
 * question_id = ?)`, which is a direct PK probe.
 *
 * No backfill from question_submissions.is_marked yet — that's a follow-up
 * once the new flow is validated in production.
 */
export class CreateUserQuestionMarks1803000000007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_question_marks" (
                "user_id" integer NOT NULL,
                "question_id" integer NOT NULL,
                "marked_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_question_marks" PRIMARY KEY ("user_id", "question_id"),
                CONSTRAINT "FK_user_question_marks_user"
                    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_user_question_marks_question"
                    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
            )
        `);

        // Secondary index so the count badge query
        //   SELECT COUNT(*) FROM user_question_marks
        //     JOIN questions q ON q.id = user_question_marks.question_id
        //   WHERE user_id = ? AND q.subject_id = ?
        // can drive from the marks side without scanning all the user's marks.
        // The PK already covers (user_id, question_id) so most lookups need
        // nothing more, but this helps the join planner pick the marks table
        // as the inner relation.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_question_marks_question"
            ON "user_question_marks" ("question_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_question_marks_question"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_question_marks"`);
    }
}
