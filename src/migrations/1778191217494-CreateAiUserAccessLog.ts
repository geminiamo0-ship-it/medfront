import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiUserAccessLog1778191217494 implements MigrationInterface {
    name = 'CreateAiUserAccessLog1778191217494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ai_user_access_logs" ("id" BIGSERIAL NOT NULL, "userId" integer NOT NULL, "featureKey" character varying(64) NOT NULL, "itemKey" character varying(255) NOT NULL, "accessDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d7e12098fb5452b1bbac79d7e35" UNIQUE ("userId", "featureKey", "itemKey", "accessDate"), CONSTRAINT "PK_f01e8c62725f371d4ab7a234224" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8ad2b5c94151dec180f9b97a5b" ON "ai_user_access_logs" ("userId") `);
        await queryRunner.query(`ALTER TABLE "ai_user_access_logs" ADD CONSTRAINT "FK_8ad2b5c94151dec180f9b97a5bf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_user_access_logs" DROP CONSTRAINT "FK_8ad2b5c94151dec180f9b97a5bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ad2b5c94151dec180f9b97a5b"`);
        await queryRunner.query(`DROP TABLE "ai_user_access_logs"`);
    }
}
