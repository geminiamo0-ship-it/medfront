import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramUsername1775860009779 implements MigrationInterface {
    name = 'AddTelegramUsername1775860009779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "telegramUsername" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegramUsername"`);
    }
}
