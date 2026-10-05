import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupportRole1776000003000 implements MigrationInterface {
  name = 'AddSupportRole1776000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'support'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres enums cannot remove values easily; keep as-is.
  }
}
