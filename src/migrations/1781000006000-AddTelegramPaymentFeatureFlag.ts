import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramPaymentFeatureFlag1781000006000
  implements MigrationInterface
{
  name = "AddTelegramPaymentFeatureFlag1781000006000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "app_settings" ("key", "value", "updated_by")
      VALUES ('ENABLE_TELEGRAM_PAYMENT_ALERTS', 'false', 'system')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "app_settings"
      WHERE "key" = 'ENABLE_TELEGRAM_PAYMENT_ALERTS'
    `);
  }
}
