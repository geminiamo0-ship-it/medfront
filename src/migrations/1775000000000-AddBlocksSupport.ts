import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlocksSupport1775000000000 implements MigrationInterface {
  name = 'AddBlocksSupport1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "tests_status_enum" ADD VALUE IF NOT EXISTS 'not_started'`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_banks" ADD "isBlockBank" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "isBlock" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "blockNumber" int`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "blockBankId" int`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "startedAt" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD CONSTRAINT "FK_tests_block_bank" FOREIGN KEY ("blockBankId") REFERENCES "question_banks"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tests_user_block_bank" ON "tests" ("userId", "isBlock", "blockBankId", "blockNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tests_block_bank" ON "tests" ("blockBankId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tests_block_bank"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tests_user_block_bank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT IF EXISTS "FK_tests_block_bank"`,
    );
    await queryRunner.query(
      `UPDATE "tests" SET "startedAt" = now() WHERE "startedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "startedAt" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "blockBankId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "blockNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "isBlock"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_banks" DROP COLUMN "isBlockBank"`,
    );
    await queryRunner.query(
      `UPDATE "tests" SET "status" = 'abandoned' WHERE "status" = 'not_started'`,
    );
    await queryRunner.query(
      `ALTER TYPE "tests_status_enum" RENAME TO "tests_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "tests_status_enum" AS ENUM ('in_progress', 'completed', 'abandoned', 'suspended')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "status" TYPE "tests_status_enum" USING "status"::text::"tests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "tests_status_enum_old"`,
    );
  }
}
