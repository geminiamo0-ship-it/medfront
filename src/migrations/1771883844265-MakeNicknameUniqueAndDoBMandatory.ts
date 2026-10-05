import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeNicknameUniqueAndDoBMandatory1771883844265 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, ensure all existing nicknames are unique by appending IDs to duplicates if any
        // This is a safety measure to prevent migration failure
        await queryRunner.query(`
            WITH duplicates AS (
                SELECT id, nickname,
                       ROW_NUMBER() OVER(PARTITION BY nickname ORDER BY id) as row_num
                FROM users
                WHERE nickname IS NOT NULL
            )
            UPDATE users
            SET nickname = nickname || '_' || id
            WHERE id IN (SELECT id FROM duplicates WHERE row_num > 1);
        `);

        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_nickname" UNIQUE ("nickname")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_nickname"`);
    }

}
