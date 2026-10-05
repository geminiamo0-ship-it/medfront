import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOmittedTestMode1772000000000 implements MigrationInterface {
  name = 'AddOmittedTestMode1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" ADD VALUE IF NOT EXISTS 'omitted'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "tests" SET "mode" = 'all' WHERE "mode" = 'omitted'`);
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" RENAME TO "tests_mode_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "tests_mode_enum" AS ENUM ('unused', 'incorrect', 'correct', 'used', 'marked', 'all')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "mode" TYPE "tests_mode_enum" USING "mode"::text::"tests_mode_enum"`,
    );
    await queryRunner.query(`DROP TYPE "tests_mode_enum_old"`);
  }
}
