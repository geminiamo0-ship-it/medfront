import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionAiExplanation1777856720357 implements MigrationInterface {
    name = 'AddQuestionAiExplanation1777856720357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "question_ai_explanations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question_id" character varying NOT NULL, "type" character varying NOT NULL, "option_id" character varying, "content" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0efc1187d845721c923a54b99c5" UNIQUE ("question_id", "type", "option_id"), CONSTRAINT "PK_20be96fb0b45de76bcd8bf4336e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "question_ai_explanations"`);
    }
}
