import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuspendedTestMode1786500000000 implements MigrationInterface {
  name = 'AddSuspendedTestMode1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new mode used for "assigned but untouched in suspended tests".
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" ADD VALUE IF NOT EXISTS 'suspended'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres enums can't remove values directly, so we recreate the enum without 'suspended'.
    await queryRunner.query(`UPDATE "tests" SET "mode" = 'all' WHERE "mode" = 'suspended'`);
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" RENAME TO "tests_mode_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "tests_mode_enum" AS ENUM ('unused', 'incorrect', 'correct', 'used', 'marked', 'omitted', 'all')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "mode" TYPE "tests_mode_enum" USING "mode"::text::"tests_mode_enum"`,
    );
    await queryRunner.query(`DROP TYPE "tests_mode_enum_old"`);
  }
}

