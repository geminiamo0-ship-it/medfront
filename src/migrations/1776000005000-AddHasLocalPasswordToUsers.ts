import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHasLocalPasswordToUsers1776000005000 implements MigrationInterface {
  name = 'AddHasLocalPasswordToUsers1776000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "has_local_password" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "has_local_password" = false
      WHERE "authProvider" = 'google'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "has_local_password"`);
  }
}
