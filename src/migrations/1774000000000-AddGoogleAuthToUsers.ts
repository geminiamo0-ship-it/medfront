import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleAuthToUsers1774000000000 implements MigrationInterface {
  name = 'AddGoogleAuthToUsers1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_auth_provider_enum" AS ENUM('local','google')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "authProvider" "public"."users_auth_provider_enum" NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "googleId" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_google_id" UNIQUE ("googleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_google_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "googleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "authProvider"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."users_auth_provider_enum"`,
    );
  }
}
