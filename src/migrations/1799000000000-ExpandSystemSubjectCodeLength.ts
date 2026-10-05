import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandSystemSubjectCodeLength1799000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "systems" ALTER COLUMN "code" TYPE varchar(100)`);
    await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "code" TYPE varchar(100)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "code" TYPE varchar(20)`);
    await queryRunner.query(`ALTER TABLE "systems" ALTER COLUMN "code" TYPE varchar(20)`);
  }
}
