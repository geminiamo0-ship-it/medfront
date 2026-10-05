import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUworldChosenByToOption1772119976727 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "question_options" ADD "uworld_chosen_by" integer`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "question_options" DROP COLUMN "uworld_chosen_by"`
        );
    }
}