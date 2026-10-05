import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminHistoryTopic1776000001000 implements MigrationInterface {
  name = 'AddAdminHistoryTopic1776000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admin_history" ADD COLUMN "topic" VARCHAR(100)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admin_history" DROP COLUMN "topic"`);
  }
}
