import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerificationToUsers1797000000000 implements MigrationInterface {
  name = "AddEmailVerificationToUsers1797000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "is_email_verified" BOOLEAN NOT NULL DEFAULT false
    `);
    
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "email_verified_at" TIMESTAMP
    `);

    // Existing users are considered verified to prevent locking them out
    await queryRunner.query(`
      UPDATE "users" 
      SET "is_email_verified" = true, "email_verified_at" = NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_email_verified"`);
  }
}
