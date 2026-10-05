import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMainBanks1740000006000 implements MigrationInterface {
  name = 'CreateMainBanks1740000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "main_banks" (
        "id"           SERIAL PRIMARY KEY,
        "name"         VARCHAR(100)  NOT NULL,
        "code"         VARCHAR(30)   NOT NULL UNIQUE,
        "description"  TEXT,
        "icon"         VARCHAR(10),
        "gradient"     VARCHAR(200),
        "isPremium"    BOOLEAN       NOT NULL DEFAULT true,
        "isActive"     BOOLEAN       NOT NULL DEFAULT true,
        "displayOrder" INT           NOT NULL DEFAULT 0,
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_main_banks_code" ON "main_banks" ("code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "main_banks"`);
  }
}
