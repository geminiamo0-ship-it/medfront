import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1740000001000 implements MigrationInterface {
  name = 'CreateUsers1740000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_role_enum"
        AS ENUM ('user', 'admin', 'super_admin', 'moderator', 'marketer')
    `);
    await queryRunner.query(`
      CREATE TYPE "users_rating_tier_enum"
        AS ENUM ('Student', 'Intern', 'Resident', 'Attending', 'Chief', 'Director')
    `);
    await queryRunner.query(`
      CREATE TYPE "users_subscription_plan_enum"
        AS ENUM ('Free', 'Basic', 'Premium')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                    SERIAL PRIMARY KEY,
        "name"                  VARCHAR(255)                  NOT NULL,
        "role"                  "users_role_enum"             NOT NULL DEFAULT 'user',
        "nickname"              VARCHAR(50),
        "email"                 VARCHAR(255)                  NOT NULL UNIQUE,
        "password"              VARCHAR(255)                  NOT NULL,
        "dateOfBirth"           DATE,
        "country"               VARCHAR(2)                    NOT NULL,
        "rating"                INT                           NOT NULL DEFAULT 1200,
        "maxRating"             INT                           NOT NULL DEFAULT 1200,
        "ratingTier"            "users_rating_tier_enum"      NOT NULL DEFAULT 'Intern',
        "contestsParticipated"  INT                           NOT NULL DEFAULT 0,
        "subscriptionPlan"      "users_subscription_plan_enum" NOT NULL DEFAULT 'Free',
        "subscriptionExpiry"    TIMESTAMP,
        "subscription_start_date" TIMESTAMP,
        "trial_start_date"      TIMESTAMP,
        "trial_end_date"        TIMESTAMP,
        "has_used_trial"        BOOLEAN                       NOT NULL DEFAULT false,
        "refreshToken"          VARCHAR(500),
        "isActive"              BOOLEAN                       NOT NULL DEFAULT true,
        "resetCount"            INT                           NOT NULL DEFAULT 0,
        "lastLoginAt"           TIMESTAMP,
        "avatarUrl"             VARCHAR(500),
        "bio"                   TEXT,
        "institution"           VARCHAR(255),
        "graduationYear"        INT,
        "specialization"        VARCHAR(100),
        "linkedinUrl"           VARCHAR(255),
        "githubUrl"             VARCHAR(255),
        "portfolioUrl"          VARCHAR(255),
        "location"              VARCHAR(100),
        "isProfilePublic"       BOOLEAN                       NOT NULL DEFAULT true,
        "showEmail"             BOOLEAN                       NOT NULL DEFAULT false,
        "showInstitution"       BOOLEAN                       NOT NULL DEFAULT true,
        "showContestHistory"    BOOLEAN                       NOT NULL DEFAULT true,
        "createdAt"             TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP                     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_subscription_plan_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_rating_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
