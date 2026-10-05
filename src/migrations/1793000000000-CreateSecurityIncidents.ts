import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSecurityIncidents1793000000000
  implements MigrationInterface
{
  name = "CreateSecurityIncidents1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "security_incidents" (
        "id" SERIAL NOT NULL,
        "actor_type" VARCHAR(32) NOT NULL,
        "actor_key" VARCHAR(255) NOT NULL,
        "user_id" INT,
        "ip" VARCHAR(64) NOT NULL,
        "user_agent" TEXT,
        "raw_path" VARCHAR(255) NOT NULL,
        "normalized_route" VARCHAR(255) NOT NULL,
        "method" VARCHAR(12) NOT NULL,
        "query_string" TEXT,
        "endpoint_family" VARCHAR(64) NOT NULL,
        "target_type" VARCHAR(64),
        "target_value" VARCHAR(128),
        "exact_endpoint_key" VARCHAR(255) NOT NULL,
        "incident_type" VARCHAR(64) NOT NULL,
        "severity" VARCHAR(16) NOT NULL,
        "score_delta" INT NOT NULL DEFAULT 0,
        "cumulative_score" INT NOT NULL DEFAULT 0,
        "action_taken" VARCHAR(64),
        "hit_count_in_window" INT NOT NULL DEFAULT 0,
        "distinct_target_count_in_window" INT NOT NULL DEFAULT 0,
        "lock_duration_seconds" INT NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_incidents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_incidents_created_at"
      ON "security_incidents" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_incidents_user_created"
      ON "security_incidents" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_incidents_ip_created"
      ON "security_incidents" ("ip", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_incidents_actor_created"
      ON "security_incidents" ("actor_key", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_incidents_family_created"
      ON "security_incidents" ("endpoint_family", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "security_actor_states" (
        "id" SERIAL NOT NULL,
        "actor_type" VARCHAR(32) NOT NULL,
        "actor_key" VARCHAR(255) NOT NULL,
        "user_id" INT,
        "ip" VARCHAR(64) NOT NULL,
        "user_agent" TEXT,
        "current_score" INT NOT NULL DEFAULT 0,
        "strike_count" INT NOT NULL DEFAULT 0,
        "cooldown_until" TIMESTAMP,
        "content_lock_until" TIMESTAMP,
        "last_incident_at" TIMESTAMP,
        "last_raw_path" VARCHAR(255),
        "last_normalized_route" VARCHAR(255),
        "last_exact_endpoint_key" VARCHAR(255),
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_actor_states" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_security_actor_states_actor_key"
      ON "security_actor_states" ("actor_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_actor_states_user_id"
      ON "security_actor_states" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_actor_states_content_lock_until"
      ON "security_actor_states" ("content_lock_until")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_actor_states_content_lock_until"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_actor_states_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_actor_states_actor_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_actor_states"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_incidents_family_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_incidents_actor_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_incidents_ip_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_incidents_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_incidents_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_incidents"`);
  }
}
