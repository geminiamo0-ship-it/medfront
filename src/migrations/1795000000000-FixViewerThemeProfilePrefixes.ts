import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixViewerThemeProfilePrefixes1795000000000
  implements MigrationInterface
{
  name = 'FixViewerThemeProfilePrefixes1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "question_banks"
      SET "viewerThemeProfile" = CASE
        WHEN UPPER("code") LIKE 'MRCP_PART_1%' OR UPPER("code") LIKE 'MRCP_PART_2%' THEN 'mrcp_passmedicine'
        WHEN UPPER("code") LIKE 'PASTEST%' OR UPPER("code") LIKE 'PAST_PAPERS%' THEN 'mrcp_pastest'
        ELSE 'standard_exam'
      END
    `);

    await queryRunner.query(`
      UPDATE "tests" t
      SET "viewerThemeProfileSnapshot" = COALESCE(
        qb."viewerThemeProfile",
        'standard_exam'
      )
      FROM "question_banks" qb
      WHERE t."blockBankId" = qb."id"
    `);

    await queryRunner.query(`
      UPDATE "tests" t
      SET "viewerThemeProfileSnapshot" = profiles.profile
      FROM (
        SELECT
          t2."id" AS "testId",
          CASE
            WHEN COUNT(DISTINCT COALESCE(qb."viewerThemeProfile", 'standard_exam')) = 1
              THEN MAX(COALESCE(qb."viewerThemeProfile", 'standard_exam'))
            ELSE 'standard_exam'
          END AS profile
        FROM "tests" t2
        LEFT JOIN LATERAL jsonb_array_elements_text(
          COALESCE(t2."filters"::jsonb -> 'questionBankIds', '[]'::jsonb)
        ) AS qbank_ids(value) ON true
        LEFT JOIN "question_banks" qb
          ON qb."id" = NULLIF(qbank_ids.value, '')::int
        GROUP BY t2."id"
      ) profiles
      WHERE t."id" = profiles."testId"
        AND t."blockBankId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "question_banks"
      SET "viewerThemeProfile" = CASE
        WHEN UPPER("code") IN ('MRCP_PART_1', 'MRCP_PART_2') THEN 'mrcp_passmedicine'
        WHEN UPPER("code") IN ('PASTEST', 'PAST_PAPERS') THEN 'mrcp_pastest'
        ELSE 'standard_exam'
      END
    `);

    await queryRunner.query(`
      UPDATE "tests" t
      SET "viewerThemeProfileSnapshot" = COALESCE(
        qb."viewerThemeProfile",
        'standard_exam'
      )
      FROM "question_banks" qb
      WHERE t."blockBankId" = qb."id"
    `);

    await queryRunner.query(`
      UPDATE "tests" t
      SET "viewerThemeProfileSnapshot" = profiles.profile
      FROM (
        SELECT
          t2."id" AS "testId",
          CASE
            WHEN COUNT(DISTINCT COALESCE(qb."viewerThemeProfile", 'standard_exam')) = 1
              THEN MAX(COALESCE(qb."viewerThemeProfile", 'standard_exam'))
            ELSE 'standard_exam'
          END AS profile
        FROM "tests" t2
        LEFT JOIN LATERAL jsonb_array_elements_text(
          COALESCE(t2."filters"::jsonb -> 'questionBankIds', '[]'::jsonb)
        ) AS qbank_ids(value) ON true
        LEFT JOIN "question_banks" qb
          ON qb."id" = NULLIF(qbank_ids.value, '')::int
        GROUP BY t2."id"
      ) profiles
      WHERE t."id" = profiles."testId"
        AND t."blockBankId" IS NULL
    `);
  }
}
