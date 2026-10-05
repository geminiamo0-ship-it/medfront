import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePartners1781000000000 implements MigrationInterface {
  name = 'CreatePartners1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "partners" (
        "id" SERIAL NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "image_url" VARCHAR(1024) NOT NULL,
        "website_url" VARCHAR(1024) NOT NULL,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partners" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "partners"`);
  }
}
