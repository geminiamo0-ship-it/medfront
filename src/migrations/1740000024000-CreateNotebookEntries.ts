import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotebookEntries1740000024000 implements MigrationInterface {
  name = 'CreateNotebookEntries1740000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notebook_entries" (
        "id"        SERIAL PRIMARY KEY,
        "user_id"   INT           NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"     VARCHAR(255)  NOT NULL,
        "content"   TEXT,
        "category"  VARCHAR(50),
        "createdAt" TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_notebook_entries_userId" ON "notebook_entries" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notebook_entries"`);
  }
}
