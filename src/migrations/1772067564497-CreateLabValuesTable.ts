import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLabValuesTable1772067564497 implements MigrationInterface {
  name = "CreateLabValuesTable1772067564497";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lab_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category" character varying(100) NOT NULL, "name" character varying(255) NOT NULL, "referenceRange" text, "siReferenceInterval" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_067976b78cd52716ded1c277ceb" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lab_values"`);
  }
}
