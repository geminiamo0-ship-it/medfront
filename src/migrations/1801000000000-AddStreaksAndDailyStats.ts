import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStreaksAndDailyStats1801000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add streak columns to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_streak" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longest_login_streak" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "question_streak" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longest_question_streak" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_question_date" date`);

        // Create user_daily_stats table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_daily_stats" (
                "id" SERIAL PRIMARY KEY,
                "user_id" integer NOT NULL,
                "date" date NOT NULL,
                "questions_attempted" integer NOT NULL DEFAULT 0,
                "correct_count" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_user_daily_stats_user_date" UNIQUE ("user_id", "date")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_daily_stats_user_date"
            ON "user_daily_stats" ("user_id", "date")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_daily_stats_user_date"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_daily_stats"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_question_date"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "longest_question_streak"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "question_streak"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "longest_login_streak"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "login_streak"`);
    }

}
