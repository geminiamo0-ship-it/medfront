import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameMrcpPassmedicineBanks1796000000000
  implements MigrationInterface
{
  name = 'RenameMrcpPassmedicineBanks1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "main_banks"
      SET "name" = CASE
        WHEN "code" = 'MRCP_PART_1' THEN 'MRCP Passmedicine 1'
        WHEN "code" = 'MRCP_PART_2' THEN 'MRCP Passmedicine 2'
        ELSE "name"
      END
      WHERE "code" IN ('MRCP_PART_1', 'MRCP_PART_2')
    `);

    await queryRunner.query(`
      UPDATE "question_banks"
      SET "name" = regexp_replace("name", 'MRCP Part 1', 'MRCP Passmedicine 1', 'g')
      WHERE UPPER("code") LIKE 'MRCP_PART_1%'
    `);

    await queryRunner.query(`
      UPDATE "question_banks"
      SET "name" = regexp_replace("name", 'MRCP Part 2', 'MRCP Passmedicine 2', 'g')
      WHERE UPPER("code") LIKE 'MRCP_PART_2%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "main_banks"
      SET "name" = CASE
        WHEN "code" = 'MRCP_PART_1' THEN 'MRCP Part 1'
        WHEN "code" = 'MRCP_PART_2' THEN 'MRCP Part 2'
        ELSE "name"
      END
      WHERE "code" IN ('MRCP_PART_1', 'MRCP_PART_2')
    `);

    await queryRunner.query(`
      UPDATE "question_banks"
      SET "name" = regexp_replace("name", 'MRCP Passmedicine 1', 'MRCP Part 1', 'g')
      WHERE UPPER("code") LIKE 'MRCP_PART_1%'
    `);

    await queryRunner.query(`
      UPDATE "question_banks"
      SET "name" = regexp_replace("name", 'MRCP Passmedicine 2', 'MRCP Part 2', 'g')
      WHERE UPPER("code") LIKE 'MRCP_PART_2%'
    `);
  }
}
