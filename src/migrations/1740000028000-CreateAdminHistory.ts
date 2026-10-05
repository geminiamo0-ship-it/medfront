import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminHistory1740000028000 implements MigrationInterface {
  name = 'CreateAdminHistory1740000028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_history" (
        "id"           SERIAL PRIMARY KEY,
        "adminEmail"   VARCHAR(255)  NOT NULL,
        "action"       VARCHAR(255)  NOT NULL,
        "targetEntity" VARCHAR(255),
        "targetId"     VARCHAR(255),
        "changes"      JSONB,
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_history"`);
  }
}
