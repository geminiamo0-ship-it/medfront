import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarkedCorrectIncorrectModes1803000000012 implements MigrationInterface {
  name = 'AddMarkedCorrectIncorrectModes1803000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additive-only: adds new values to the enum without touching any existing rows or values
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" ADD VALUE IF NOT EXISTS 'marked_correct'`);
    await queryRunner.query(`ALTER TYPE "tests_mode_enum" ADD VALUE IF NOT EXISTS 'marked_incorrect'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values natively.
    // To roll back, delete all rows where mode IN ('marked_correct','marked_incorrect') first, then recreate the type.
    // In practice: rolling back by deploying the previous frontend/backend version is sufficient,
    // as old code will never send these modes.
    console.warn('Down migration for AddMarkedCorrectIncorrectModes: Postgres cannot remove enum values. Deploy previous code to stop using these modes.');
  }
}
