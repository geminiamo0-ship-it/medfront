import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMixedModeEnum1798000000000 implements MigrationInterface {
  name = 'AddMixedModeEnum1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additive-only: adds a new value to the enum without touching any existing rows or values
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" ADD VALUE IF NOT EXISTS 'mixed_modes'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values natively.
    // To roll back, delete all rows where mode = 'mixed_modes' first, then recreate the type.
    // In practice: rolling back by deploying the previous frontend/backend version is sufficient,
    // as old code will never send mode = 'mixed_modes'.
    console.warn('Down migration for AddMixedModeEnum: Postgres cannot remove enum values. Deploy previous code to stop using mixed_modes.');
  }
}
