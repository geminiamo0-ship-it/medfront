import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystems1740000004000 implements MigrationInterface {
  name = 'CreateSystems1740000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "systems" (
        "id"           SERIAL PRIMARY KEY,
        "name"         VARCHAR(100)  NOT NULL,
        "code"         VARCHAR(20)   NOT NULL UNIQUE,
        "description"  TEXT,
        "icon"         VARCHAR(50),
        "displayOrder" INT           NOT NULL DEFAULT 0,
        "isActive"     BOOLEAN       NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_systems_code" ON "systems" ("code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "systems"`);
  }
}
