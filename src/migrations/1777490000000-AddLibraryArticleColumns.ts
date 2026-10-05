import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLibraryArticleColumns1777490000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns
        await queryRunner.query(`ALTER TABLE "library_articles" ADD "external_caller" character varying`);
        await queryRunner.query(`ALTER TABLE "library_articles" ADD "library_name" character varying`);

        // Add unique index on (source, name, category) for deduplication
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_library_articles_source_name_category" ON "library_articles" ("source", "name", "category")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_library_articles_source_name_category"`);
        await queryRunner.query(`ALTER TABLE "library_articles" DROP COLUMN "library_name"`);
        await queryRunner.query(`ALTER TABLE "library_articles" DROP COLUMN "external_caller"`);
    }
}
