import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLibrarySearchIndex1783000000000 implements MigrationInterface {
  name = 'AddLibrarySearchIndex1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "library_articles_search_idx"
      ON "library_articles"
      USING GIN (
        to_tsvector(
          'english',
          coalesce("name", '') || ' ' ||
          regexp_replace(coalesce("content_html", ''), '<[^>]+>', ' ', 'g')
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "library_articles_search_idx"`);
  }
}
