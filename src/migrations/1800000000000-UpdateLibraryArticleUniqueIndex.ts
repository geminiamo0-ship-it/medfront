import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLibraryArticleUniqueIndex1800000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_library_articles_source_name_category"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_library_articles_source_name" ON "library_articles" ("source", "name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_library_articles_source_name"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_library_articles_source_name_category" ON "library_articles" ("source", "name", "category")`);
    }

}
