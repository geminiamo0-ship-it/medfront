import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromoCodes1740000002000 implements MigrationInterface {
  name = 'CreatePromoCodes1740000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "promo_codes" (
        "id"              SERIAL PRIMARY KEY,
        "code"            VARCHAR(255)  NOT NULL UNIQUE,
        "discountPercent" INT           NOT NULL,
        "isActive"        BOOLEAN       NOT NULL DEFAULT true,
        "expiresAt"       TIMESTAMP,
        "maxUses"         INT,
        "usedCount"       INT           NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "promo_codes"`);
  }
}
