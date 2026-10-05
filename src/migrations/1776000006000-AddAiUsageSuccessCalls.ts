import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAiUsageSuccessCalls1776000006000 implements MigrationInterface {
  name = "AddAiUsageSuccessCalls1776000006000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" ADD COLUMN "successCalls" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" DROP COLUMN "successCalls"`,
    );
  }
}
