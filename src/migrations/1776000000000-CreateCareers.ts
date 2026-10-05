import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCareers1776000000000 implements MigrationInterface {
  name = 'CreateCareers1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "job_postings_status_enum" AS ENUM ('open', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "job_applications_status_enum" AS ENUM ('new', 'reviewed', 'shortlisted', 'rejected', 'hired')`,
    );

    await queryRunner.query(`
      CREATE TABLE "job_postings" (
        "id" SERIAL NOT NULL,
        "title" character varying(160) NOT NULL,
        "department" character varying(120) NOT NULL,
        "location" character varying(120) NOT NULL,
        "employmentType" character varying(60) NOT NULL,
        "level" character varying(60) NOT NULL,
        "summary" text NOT NULL,
        "description" text,
        "responsibilities" text,
        "requirements" text,
        "status" "job_postings_status_enum" NOT NULL DEFAULT 'open',
        "publishedAt" TIMESTAMP,
        "closedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_postings_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "job_applications" (
        "id" SERIAL NOT NULL,
        "jobId" integer NOT NULL,
        "fullName" character varying(160) NOT NULL,
        "email" character varying(160) NOT NULL,
        "phone" character varying(60) NOT NULL,
        "country" character varying(120) NOT NULL,
        "currentRole" character varying(160) NOT NULL,
        "linkedinUrl" character varying(255),
        "portfolioUrl" character varying(255),
        "coverLetter" text,
        "resumeUrl" character varying(500) NOT NULL,
        "status" "job_applications_status_enum" NOT NULL DEFAULT 'new',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_applications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "job_applications" ADD CONSTRAINT "FK_job_applications_job" FOREIGN KEY ("jobId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_job_postings_status" ON "job_postings" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_applications_jobId" ON "job_applications" ("jobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_applications_status" ON "job_applications" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_applications_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_applications_jobId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_postings_status"`);
    await queryRunner.query(`ALTER TABLE "job_applications" DROP CONSTRAINT "FK_job_applications_job"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_postings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_applications_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_postings_status_enum"`);
  }
}
