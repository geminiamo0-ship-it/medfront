import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPreferences1740000029000 implements MigrationInterface {
  name = 'CreateUserPreferences1740000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_preferences_theme_enum"
        AS ENUM ('light', 'dark')
    `);

    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "id"                     SERIAL PRIMARY KEY,
        "userId"                 INT                          NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "theme"                  "user_preferences_theme_enum" NOT NULL DEFAULT 'dark',
        "emailNotifications"     BOOLEAN                      NOT NULL DEFAULT true,
        "contestReminders"       BOOLEAN                      NOT NULL DEFAULT true,
        "defaultStep"            INT                          NOT NULL DEFAULT 1,
        "defaultQuestionBankId"  INT,
        "createdAt"              TIMESTAMP                    NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP                    NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_preferences_theme_enum"`);
  }
}
