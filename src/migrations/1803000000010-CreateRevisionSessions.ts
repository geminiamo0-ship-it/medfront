import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Revision sessions over a user's marked questions, scoped to
 * (q_bank_id, subject_id, optional system_id). Each row snapshots the
 * question IDs included in that session so future sessions on the same slice
 * can exclude already-snapshotted IDs — preventing repeat questions across
 * separate revision sittings even when the underlying mark set shifts.
 *
 * Not a Test: revision sessions never feed analytics or appear in
 * Previous tests.
 */
export class CreateRevisionSessions1803000000010 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "revision_sessions" (
                "id" SERIAL PRIMARY KEY,
                "user_id" integer NOT NULL,
                "q_bank_id" integer NOT NULL,
                "subject_id" integer NOT NULL,
                "system_id" integer,
                "question_ids" integer[] NOT NULL DEFAULT '{}',
                "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "completed_at" TIMESTAMPTZ,
                "last_viewed_index" integer NOT NULL DEFAULT 0,
                CONSTRAINT "FK_revision_sessions_user"
                    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_revision_sessions_q_bank"
                    FOREIGN KEY ("q_bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_revision_sessions_subject"
                    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_revision_sessions_system"
                    FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE
            )
        `);

        // Drives the "remaining-count" query for the picker (overview endpoint)
        // and the "exclude already-snapshotted IDs" query when creating a new
        // session. Both filter on (user_id, q_bank_id, subject_id, system_id,
        // completed_at IS NOT NULL).
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_revision_sessions_slice"
            ON "revision_sessions" ("user_id", "q_bank_id", "subject_id", "system_id", "completed_at")
        `);

        // Resume lookup: latest incomplete session for a slice.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_revision_sessions_active"
            ON "revision_sessions" ("user_id", "q_bank_id", "subject_id", "system_id")
            WHERE "completed_at" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_revision_sessions_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_revision_sessions_slice"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "revision_sessions"`);
    }
}
