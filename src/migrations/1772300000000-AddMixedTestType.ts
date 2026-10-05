import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMixedTestType1772300000000 implements MigrationInterface {
  name = 'AddMixedTestType1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "tests_type_enum" ADD VALUE IF NOT EXISTS 'mixed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "tests" SET "type" = 'timed' WHERE "type" = 'mixed'`);
    await queryRunner.query(`ALTER TYPE "tests_type_enum" RENAME TO "tests_type_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "tests_type_enum" AS ENUM ('tutor', 'timed', 'custom')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "type" TYPE "tests_type_enum" USING "type"::text::"tests_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "tests_type_enum_old"`);
  }
}
