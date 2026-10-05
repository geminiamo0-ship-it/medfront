import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateQuotaAndIpSecurityTables1794000000000
  implements MigrationInterface
{
  name = "CreateQuotaAndIpSecurityTables1794000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_quota_counters" (
        "id" SERIAL NOT NULL,
        "user_id" INT NOT NULL,
        "quota_type" VARCHAR(64) NOT NULL,
        "day_bucket" DATE NOT NULL,
        "count" INT NOT NULL DEFAULT 0,
        "distinct_target_count" INT NOT NULL DEFAULT 0,
        "first_hit_at" TIMESTAMP,
        "last_hit_at" TIMESTAMP,
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_quota_counters" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_quota_counters_unique"
      ON "user_quota_counters" ("user_id", "quota_type", "day_bucket")
    `);

    await queryRunner.query(`
      CREATE TABLE "blocked_ips" (
        "id" SERIAL NOT NULL,
        "ip" VARCHAR(64) NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "reason" VARCHAR(128) NOT NULL,
        "linked_user_id" INT,
        "source_type" VARCHAR(64),
        "source_id" INT,
        "blocked_by" VARCHAR(255),
        "blocked_at" TIMESTAMP NOT NULL DEFAULT now(),
        "unblocked_at" TIMESTAMP,
        "unblocked_by" VARCHAR(255),
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blocked_ips" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_blocked_ips_ip" ON "blocked_ips" ("ip")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_blocked_ips_active" ON "blocked_ips" ("active")
    `);

    await queryRunner.query(`
      CREATE TABLE "blocked_ip_attempts" (
        "id" SERIAL NOT NULL,
        "ip" VARCHAR(64) NOT NULL,
        "action" VARCHAR(32) NOT NULL,
        "email" VARCHAR(255),
        "nickname" VARCHAR(100),
        "path" VARCHAR(255) NOT NULL,
        "user_agent" TEXT,
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blocked_ip_attempts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_blocked_ip_attempts_ip_created"
      ON "blocked_ip_attempts" ("ip", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_blocked_ip_attempts_action_created"
      ON "blocked_ip_attempts" ("action", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_ip_attempts_action_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_ip_attempts_ip_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blocked_ip_attempts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_ips_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_ips_ip"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blocked_ips"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_quota_counters_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_quota_counters"`);
  }
}
