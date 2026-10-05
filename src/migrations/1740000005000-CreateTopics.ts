import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTopics1740000005000 implements MigrationInterface {
  name = 'CreateTopics1740000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "topics" (
        "id"           SERIAL PRIMARY KEY,
        "subjectId"    INT           NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
        "systemId"     INT                    REFERENCES "systems"("id")  ON DELETE SET NULL,
        "name"         VARCHAR(200)  NOT NULL,
        "description"  TEXT,
        "displayOrder" INT           NOT NULL DEFAULT 0,
        "isActive"     BOOLEAN       NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_topics_subjectId" ON "topics" ("subjectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_topics_systemId"  ON "topics" ("systemId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "topics"`);
  }
}
