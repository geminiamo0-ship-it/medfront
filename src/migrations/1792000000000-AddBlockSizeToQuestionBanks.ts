import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockSizeToQuestionBanks1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "blockSize" int NOT NULL DEFAULT 20`,
    );

    // Set isBlockBank = true and blockSize = 100 for all past-papers banks (MRCP Part 1 & 2)
    await queryRunner.query(
      `UPDATE "question_banks"
       SET "isBlockBank" = true, "blockSize" = 100
       WHERE "code" LIKE 'PAST_PAPERS_%'
         AND "step" IN (4, 5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "question_banks"
       SET "isBlockBank" = false
       WHERE "code" LIKE 'PAST_PAPERS_%'
         AND "step" IN (4, 5)`,
    );

    await queryRunner.query(
      `ALTER TABLE "question_banks" DROP COLUMN IF EXISTS "blockSize"`,
    );
  }
}
