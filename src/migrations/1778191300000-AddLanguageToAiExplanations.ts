import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLanguageToAiExplanations1778191300000 implements MigrationInterface {
    name = 'AddLanguageToAiExplanations1778191300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add language column with default 'en'
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" ADD "language" character varying(5) NOT NULL DEFAULT 'en'`);

        // Drop old unique constraint (questionId, type, optionId)
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" DROP CONSTRAINT IF EXISTS "UQ_question_ai_explanations_questionId_type_optionId"`);
        // Also try the auto-generated constraint name pattern
        await queryRunner.query(`
            DO $$ BEGIN
                EXECUTE (
                    SELECT 'ALTER TABLE "question_ai_explanations" DROP CONSTRAINT "' || conname || '"'
                    FROM pg_constraint
                    WHERE conrelid = '"question_ai_explanations"'::regclass
                      AND contype = 'u'
                      AND array_length(conkey, 1) >= 3
                    LIMIT 1
                );
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `);

        // Create new unique constraint including language
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" ADD CONSTRAINT "UQ_ai_explanations_question_type_option_lang" UNIQUE ("question_id", "type", "option_id", "language")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" DROP CONSTRAINT IF EXISTS "UQ_ai_explanations_question_type_option_lang"`);
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" DROP COLUMN "language"`);
        // Re-create original constraint
        await queryRunner.query(`ALTER TABLE "question_ai_explanations" ADD CONSTRAINT "UQ_question_ai_explanations_questionId_type_optionId" UNIQUE ("question_id", "type", "option_id")`);
    }
}
