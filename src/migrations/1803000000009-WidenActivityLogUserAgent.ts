import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Widens user_activity_logs.user_agent from varchar(255) to text.
 *
 * Why: In-app browsers on mobile (Instagram, Facebook, TikTok, etc.)
 * append their own identifying suffix to the User-Agent header. The
 * Instagram Android client on a Samsung A346E emits a UA of 269 chars —
 * over the 255 limit. Inserts then fail with Postgres error 22001
 * ("value too long for type character varying(255)"), and the activity
 * bulk-insert endpoint returns 500.
 *
 * The fix has two layers:
 *   1. Application-side defensive cap in `ActivityService.bulkInsert`
 *      (immediate, prevents crash regardless of schema).
 *   2. This migration — widens the column to TEXT so we keep the full
 *      UA string and don't lose information that's useful for security
 *      analytics and abuse detection. All other security/audit tables in
 *      this codebase already use TEXT for user_agent (see
 *      blocked_ip_attempts, request_rate_limit_alerts, security_incidents,
 *      security_actor_states). This brings user_activity_logs in line.
 *
 * Safety:
 *   - PostgreSQL's `ALTER TYPE ... TYPE text` is fast and non-blocking
 *     for varchar → text on indexed columns when the data already fits.
 *     No data validation pass required (every existing value is by
 *     definition ≤ 255 chars and therefore valid TEXT).
 *   - No index on user_agent in this table, so no index rebuild.
 *   - Reversible (the down migration converts back to varchar(255), but
 *     any row inserted between up and down with a longer UA would lose
 *     its trailing characters; that's expected for a downgrade).
 */
export class WidenActivityLogUserAgent1803000000009
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" ALTER COLUMN "user_agent" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Downgrade: truncate any rows whose user_agent exceeds 255 chars
    // BEFORE the type change, otherwise PostgreSQL rejects the migration.
    await queryRunner.query(
      `UPDATE "user_activity_logs" SET "user_agent" = substring("user_agent" from 1 for 255) WHERE length("user_agent") > 255`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" ALTER COLUMN "user_agent" TYPE varchar(255)`,
    );
  }
}
