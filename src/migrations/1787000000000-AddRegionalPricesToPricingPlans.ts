import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRegionalPricesToPricingPlans1787000000000 implements MigrationInterface {
    name = 'AddRegionalPricesToPricingPlans1787000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pricing_plans" ADD "regional_prices" jsonb DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pricing_plans" DROP COLUMN "regional_prices"`);
    }
}
