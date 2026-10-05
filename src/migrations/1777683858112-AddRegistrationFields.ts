import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRegistrationFields1777683858112 implements MigrationInterface {
    name = 'AddRegistrationFields1777683858112'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "heard_about_us_from" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "heard_about_us_from"`);
    }
}
