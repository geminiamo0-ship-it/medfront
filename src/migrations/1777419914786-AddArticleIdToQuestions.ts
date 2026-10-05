import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArticleIdToQuestions1777419914786 implements MigrationInterface {
    name = 'AddArticleIdToQuestions1777419914786'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "questions" ADD "articleId" integer`);
        await queryRunner.query(`ALTER TABLE "questions" ADD "libraryName" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "libraryName"`);
        await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "articleId"`);
    }
}
