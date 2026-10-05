import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { TestStatus } from '../entities/test.entity';

type CandidateRow = {
  id: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  blockBankId: number | null;
  bankName: string | null;
  blockNumber: number | null;
  title: string;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
};

type DeleteSummary = {
  verifiedCandidateTests: number;
  deletedQuestionSubmissions: number;
  deletedQuestionInteractions: number;
  deletedTestQuestions: number;
  deletedTestAnalyticsSnapshots: number;
  deletedTests: number;
};

const DELETE_CHUNK_SIZE = 500;

function parseOptionalInt(value: string | undefined, label: string) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, label: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO date`);
  }
  return parsed;
}

function buildCandidateQuery(filters: {
  userId?: number | null;
  blockBankId?: number | null;
  createdBefore?: Date | null;
  ids?: number[];
}) {
  const params: any[] = [TestStatus.NOT_STARTED];
  const conditions = [
    `t."isBlock" = true`,
    `t.status = $1`,
    `t."startedAt" IS NULL`,
    `COALESCE(t."answeredQuestions", 0) = 0`,
    `COALESCE(t."correctAnswers", 0) = 0`,
    `COALESCE(t."omittedQuestions", 0) = 0`,
    `COALESCE(t."rightToWrongChanges", 0) = 0`,
    `COALESCE(t."timeSpentSeconds", 0) = 0`,
    `t."completedAt" IS NULL`,
    `NOT EXISTS (SELECT 1 FROM question_submissions qs WHERE qs."testId" = t.id)`,
    `NOT EXISTS (SELECT 1 FROM question_interactions qi WHERE qi."testId" = t.id)`,
  ];

  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`t."userId" = $${params.length}`);
  }

  if (filters.blockBankId) {
    params.push(filters.blockBankId);
    conditions.push(`t."blockBankId" = $${params.length}`);
  }

  if (filters.createdBefore) {
    params.push(filters.createdBefore.toISOString());
    conditions.push(`t."createdAt" < $${params.length}`);
  }

  if (filters.ids?.length) {
    params.push(filters.ids);
    conditions.push(`t.id = ANY($${params.length}::int[])`);
  }

  const whereClause = conditions.join('\n      AND ');

  const detailSql = `
    SELECT
      t.id,
      t."userId" AS "userId",
      u.email AS "userEmail",
      u.name AS "userName",
      t."blockBankId" AS "blockBankId",
      qb.name AS "bankName",
      t."blockNumber" AS "blockNumber",
      t.title,
      t."totalQuestions" AS "totalQuestions",
      t."createdAt" AS "createdAt",
      t."updatedAt" AS "updatedAt"
    FROM tests t
    LEFT JOIN users u ON u.id = t."userId"
    LEFT JOIN question_banks qb ON qb.id = t."blockBankId"
    WHERE ${whereClause}
    ORDER BY t."userId" ASC, t."blockBankId" ASC NULLS LAST, t."blockNumber" ASC NULLS LAST, t.id ASC
  `;

  return { sql: detailSql, params };
}

async function deleteInChunks(
  manager: DataSource['manager'],
  sql: string,
  ids: number[],
): Promise<number> {
  let deleted = 0;

  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    if (!chunk.length) {
      continue;
    }

    const result = await manager.query(sql, [chunk]);
    if (Array.isArray(result)) {
      deleted += result.length;
      continue;
    }

    if (typeof result?.rowCount === 'number') {
      deleted += result.rowCount;
    }
  }

  return deleted;
}

async function bootstrap() {
  const userId = parseOptionalInt(process.env.USER_ID, 'USER_ID');
  const blockBankId = parseOptionalInt(process.env.BLOCK_BANK_ID, 'BLOCK_BANK_ID');
  const createdBefore = parseOptionalDate(process.env.CREATED_BEFORE, 'CREATED_BEFORE');
  const applyDelete = String(process.env.APPLY_DELETE || '').toLowerCase() === 'true';
  const previewLimit = Math.max(1, Number(process.env.PREVIEW_LIMIT || 20));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const { sql, params } = buildCandidateQuery({
      userId,
      blockBankId,
      createdBefore,
    });

    const candidates = (await dataSource.query(sql, params)) as CandidateRow[];

    const users = new Map<
      number,
      {
        userEmail: string | null;
        userName: string | null;
        tests: CandidateRow[];
      }
    >();

    for (const row of candidates) {
      const bucket = users.get(Number(row.userId)) || {
        userEmail: row.userEmail,
        userName: row.userName,
        tests: [],
      };
      bucket.tests.push(row);
      users.set(Number(row.userId), bucket);
    }

    const uniqueBankIds = new Set(
      candidates
        .map((row) => Number(row.blockBankId))
        .filter((value) => Number.isInteger(value) && value > 0),
    );

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: applyDelete ? 'delete' : 'dry-run',
          filters: {
            userId,
            blockBankId,
            createdBefore: createdBefore ? createdBefore.toISOString() : null,
          },
          totals: {
            candidateTests: candidates.length,
            affectedUsers: users.size,
            affectedBlockBanks: uniqueBankIds.size,
          },
          preview: candidates.slice(0, previewLimit),
        },
        null,
        2,
      ),
    );

    if (!applyDelete || candidates.length === 0) {
      await app.close();
      return;
    }

    const candidateIds = candidates.map((row) => Number(row.id)).filter((id) => Number.isInteger(id));

    const deleteSummary = await dataSource.transaction<DeleteSummary>(async (manager) => {
      const verification = buildCandidateQuery({
        userId,
        blockBankId,
        createdBefore,
        ids: candidateIds,
      });

      const verifiedRows = (await manager.query(verification.sql, verification.params)) as CandidateRow[];
      const verifiedIds = verifiedRows
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (verifiedIds.length === 0) {
        return {
          verifiedCandidateTests: 0,
          deletedQuestionSubmissions: 0,
          deletedQuestionInteractions: 0,
          deletedTestQuestions: 0,
          deletedTestAnalyticsSnapshots: 0,
          deletedTests: 0,
        };
      }

      const deletedQuestionSubmissions = await deleteInChunks(
        manager,
        `DELETE FROM question_submissions WHERE "testId" = ANY($1::int[]) RETURNING id`,
        verifiedIds,
      );
      const deletedQuestionInteractions = await deleteInChunks(
        manager,
        `DELETE FROM question_interactions WHERE "testId" = ANY($1::int[]) RETURNING id`,
        verifiedIds,
      );
      const deletedTestQuestions = await deleteInChunks(
        manager,
        `DELETE FROM test_questions WHERE "testId" = ANY($1::int[]) RETURNING id`,
        verifiedIds,
      );
      const deletedTestAnalyticsSnapshots = await deleteInChunks(
        manager,
        `DELETE FROM test_analytics_snapshots WHERE "testId" = ANY($1::int[]) RETURNING id`,
        verifiedIds,
      );
      const deletedTests = await deleteInChunks(
        manager,
        `DELETE FROM tests WHERE id = ANY($1::int[]) RETURNING id`,
        verifiedIds,
      );

      return {
        verifiedCandidateTests: verifiedIds.length,
        deletedQuestionSubmissions,
        deletedQuestionInteractions,
        deletedTestQuestions,
        deletedTestAnalyticsSnapshots,
        deletedTests,
      };
    });

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ...deleteSummary,
          requestedCandidateTests: candidateIds.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
