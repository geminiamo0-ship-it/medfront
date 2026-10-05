import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLibrarySource1777487906850 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "main_banks" ADD "librarySource" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "tests" ADD "librarySourceSnapshot" character varying(50) NOT NULL DEFAULT 'all'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "librarySourceSnapshot"`);
        await queryRunner.query(`ALTER TABLE "main_banks" DROP COLUMN "librarySource"`);
    }
}
