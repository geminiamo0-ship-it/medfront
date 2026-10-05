import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuspendedTestStatus1772000001000 implements MigrationInterface {
  name = 'AddSuspendedTestStatus1772000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "tests_status_enum" ADD VALUE IF NOT EXISTS 'suspended'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "tests" SET "status" = 'abandoned' WHERE "status" = 'suspended'`);
    await queryRunner.query(`ALTER TYPE "tests_status_enum" RENAME TO "tests_status_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "tests_status_enum" AS ENUM ('in_progress', 'completed', 'abandoned')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "status" TYPE "tests_status_enum" USING "status"::text::"tests_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "tests_status_enum_old"`);
  }
}
