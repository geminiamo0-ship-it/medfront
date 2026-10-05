import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneNumberToUsers1772200000000 implements MigrationInterface {
  name = 'AddPhoneNumberToUsers1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add phoneNumber column as nullable first so existing rows don't fail
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneNumber" varchar(20) NULL`,
    );
    // Backfill existing rows with a placeholder (temp name/id) to avoid unique violation if there are multiple
    // Ideally, existing users should be handled manually, but for safety:
    await queryRunner.query(
      `UPDATE "users" SET "phoneNumber" = 'UNKNOWN_' || id WHERE "phoneNumber" IS NULL`,
    );
    // Now make the column NOT NULL and UNIQUE
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "phoneNumber" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_user_phone_number" UNIQUE ("phoneNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_user_phone_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "phoneNumber"`,
    );
  }
}
