import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpecialBadges1802000000001 implements MigrationInterface {
  name = "AddSpecialBadges1802000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "special_badge_types" (
        "id"          SERIAL        NOT NULL,
        "key"         VARCHAR(64)   NOT NULL,
        "label"       VARCHAR(100)  NOT NULL,
        "description" VARCHAR(255)  NOT NULL DEFAULT '',
        "icon"        VARCHAR(10)   NOT NULL DEFAULT '🏅',
        "color"       VARCHAR(20)   NOT NULL DEFAULT '#6366f1',
        "is_active"   BOOLEAN       NOT NULL DEFAULT true,
        "created_at"  TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_special_badge_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_special_badge_types_key"   UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_special_badges" (
        "id"            SERIAL       NOT NULL,
        "user_id"       INT          NOT NULL,
        "badge_type_id" INT          NOT NULL,
        "awarded_by"    VARCHAR(100) NOT NULL,
        "note"          TEXT,
        "awarded_at"    TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_special_badges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_special_badges_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_special_badges_type"
          FOREIGN KEY ("badge_type_id") REFERENCES "special_badge_types"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_special_badges_user" ON "user_special_badges" ("user_id")
    `);

    // Seed default badge types
    await queryRunner.query(`
      INSERT INTO "special_badge_types" ("key","label","description","icon","color") VALUES
        ('supporter',    'Supporter',       'Actively supports MedPark and its community',      '💙', '#3b82f6'),
        ('bug_catcher',  'Bug Catcher',     'Found and reported a bug that improved the platform','🐛', '#22c55e'),
        ('early_bird',   'Early Bird',      'Joined MedPark during early access',                '🐦', '#f59e0b'),
        ('top_scorer',   'Top Scorer',      'Achieved a top score in a contest',                 '🏆', '#eab308'),
        ('contributor',  'Contributor',     'Contributed to the platform in a meaningful way',   '⭐', '#8b5cf6'),
        ('feedback_hero','Feedback Hero',   'Provided consistently valuable feedback',           '🎯', '#ec4899'),
        ('vip',          'VIP',             'Very important person — special recognition',       '👑', '#f97316'),
        ('legend',       'Legend',          'Legendary status — reserved for exceptional users', '🔥', '#ef4444')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_special_badges_user"`);
    await queryRunner.query(`DROP TABLE "user_special_badges"`);
    await queryRunner.query(`DROP TABLE "special_badge_types"`);
  }
}
