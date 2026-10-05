import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { DataSource, In } from 'typeorm';
import { Question } from '../entities/question.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { QuestionGrouping } from '../entities/question-grouping.entity';

type Group = string[];

type ExpectedRow = {
  questionBankId: number;
  questionBankCode: string;
  externalId: string;
  groupKey: string;
  position: number;
};

function parseArg(flag: string): string | null {
  const idx = process.argv.findIndex((arg) => arg === flag || arg.startsWith(flag + '='));
  if (idx === -1) return null;
  const arg = process.argv[idx];
  if (arg.includes('=')) return arg.split('=').slice(1).join('=');
  const next = process.argv[idx + 1];
  return next && !next.startsWith('--') ? next : null;
}

function normalizeExternalId(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '');
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid externalId: ${raw}`);
  }
  return trimmed;
}

function computeGroupKey(externalIds: string[]): string {
  let min = Number.POSITIVE_INFINITY;
  for (const id of externalIds) {
    const n = Number(id);
    if (Number.isFinite(n) && n < min) min = n;
  }
  if (!Number.isFinite(min)) {
    throw new Error('Failed to compute groupKey');
  }
  return String(min);
}

function parseLegacyFormatPerSource(json: any): Record<string, Group[]> {
  const groupsBySource: Record<string, Group[]> = {};

  for (const sourcePath of Object.keys(json || {})) {
    const combos = json[sourcePath];
    if (!combos || typeof combos !== 'object') continue;

    const rawGroups: Array<Array<string | number>> = [];
    for (const key of Object.keys(combos)) {
      const arr = combos[key];
      if (!Array.isArray(arr) || arr.length < 2) continue;
      rawGroups.push(arr);
    }
    if (rawGroups.length === 0) continue;

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x);
      if (!p || p === x) {
        parent.set(x, x);
        return x;
      }
      const root = find(p);
      parent.set(x, root);
      return root;
    };

    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };

    for (const arr of rawGroups) {
      const first = String(arr[0]);
      find(first);
      for (let i = 1; i < arr.length; i++) {
        const v = String(arr[i]);
        find(v);
        union(first, v);
      }
    }

    const rootToMembers = new Map<string, Set<string>>();
    for (const arr of rawGroups) {
      for (const v of arr) {
        const s = String(v);
        const r = find(s);
        let set = rootToMembers.get(r);
        if (!set) {
          set = new Set<string>();
          rootToMembers.set(r, set);
        }
        set.add(s);
      }
    }

    const groups: Group[] = [];
    for (const members of rootToMembers.values()) {
      const sorted = Array.from(members)
        .map(normalizeExternalId)
        .sort((a, b) => Number(a) - Number(b));
      if (sorted.length >= 2) groups.push(sorted);
    }

    groupsBySource[sourcePath] = groups;
  }

  return groupsBySource;
}

function normalizeGroups(groups: Array<Array<string | number>>): Group[] {
  const normalized: Group[] = [];
  const uniqueKeySet = new Set<string>();

  for (const rawGroup of groups || []) {
    if (!Array.isArray(rawGroup) || rawGroup.length < 2) continue;
    const seen = new Set<string>();
    const group: string[] = [];

    for (const rawId of rawGroup) {
      const id = normalizeExternalId(rawId);
      if (seen.has(id)) {
        throw new Error(`Duplicate externalId in group: ${id}`);
      }
      seen.add(id);
      group.push(id);
    }

    const key = group.join('|');
    if (uniqueKeySet.has(key)) continue;
    uniqueKeySet.add(key);
    normalized.push(group);
  }

  return normalized;
}

function usage(): never {
  console.log(
    [
      'Usage:',
      '  npm run verify:question-groupings -- --json="question_groupings (1).json" --bankMap="bank-map.json"',
      '',
      'Notes:',
      '  - For legacy source-keyed JSON, --bankMap is required.',
      '  - The script compares the DB against what the importer would actually write.',
      '  - It reports rows missing in DB and extra rows already present in DB.',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  config();

  const jsonArg = parseArg('--json') || 'question_groupings (1).json';
  const bankMapArg = parseArg('--bankMap');
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(process.cwd(), jsonArg);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found: ${jsonPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const isArrayFormat = Array.isArray(parsed);

  if (isArrayFormat) {
    throw new Error('This verifier currently supports only legacy source-keyed JSON.');
  }

  if (!bankMapArg) {
    throw new Error('Legacy source-keyed JSON requires --bankMap=PATH_TO_JSON');
  }

  const bankMapPath = path.isAbsolute(bankMapArg) ? bankMapArg : path.join(process.cwd(), bankMapArg);
  if (!fs.existsSync(bankMapPath)) {
    throw new Error(`Bank map JSON not found: ${bankMapPath}`);
  }

  const bankMap = JSON.parse(fs.readFileSync(bankMapPath, 'utf8')) as Record<string, string>;
  const groupsBySource = parseLegacyFormatPerSource(parsed);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [path.join(process.cwd(), 'src/**/*.entity.ts')],
    synchronize: false,
    logging: false,
    ...(process.env.DB_SSL === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  await dataSource.initialize();

  try {
    const questionRepo = dataSource.getRepository(Question);
    const bankRepo = dataSource.getRepository(QuestionBank);
    const groupingRepo = dataSource.getRepository(QuestionGrouping);

    const sourceEntries = Object.entries(groupsBySource);
    const bankCodes = Array.from(
      new Set(
        sourceEntries
          .map(([sourcePath]) => (bankMap[sourcePath] || '').trim())
          .filter(Boolean),
      ),
    );

    const banks = await bankRepo.find({
      where: { code: In(bankCodes) },
      select: ['id', 'code'],
    });

    const bankByCode = new Map(banks.map((bank) => [bank.code, bank]));
    const missingMappings = sourceEntries
      .filter(([sourcePath]) => !(bankMap[sourcePath] || '').trim())
      .map(([sourcePath]) => sourcePath);

    const unknownBankCodes = bankCodes.filter((code) => !bankByCode.has(code));
    const expectedRows: ExpectedRow[] = [];
    const summary: Array<Record<string, unknown>> = [];

    for (const [sourcePath, rawGroups] of sourceEntries) {
      const questionBankCode = (bankMap[sourcePath] || '').trim();
      if (!questionBankCode) continue;

      const bank = bankByCode.get(questionBankCode);
      if (!bank) continue;

      const normalizedGroups = normalizeGroups(rawGroups);
      const receivedExternalIds = Array.from(new Set(normalizedGroups.flatMap((group) => group)));

      const existingQuestions = receivedExternalIds.length
        ? await questionRepo.find({
            where: {
              questionBankId: bank.id,
              externalId: In(receivedExternalIds),
              isActive: true,
            },
            select: ['externalId'],
          })
        : [];

      const existingSet = new Set(existingQuestions.map((q) => String(q.externalId)));
      const importableGroups = normalizedGroups.filter((group) => group.every((id) => existingSet.has(id)));

      for (const group of importableGroups) {
        const groupKey = computeGroupKey(group);
        for (let i = 0; i < group.length; i++) {
          expectedRows.push({
            questionBankId: bank.id,
            questionBankCode: bank.code,
            externalId: group[i],
            groupKey,
            position: i + 1,
          });
        }
      }

      summary.push({
        sourcePath,
        questionBankCode: bank.code,
        groupsInJson: normalizedGroups.length,
        groupsImportableFromDb: importableGroups.length,
        expectedRows: importableGroups.reduce((sum, group) => sum + group.length, 0),
      });
    }

    const bankIds = Array.from(new Set(expectedRows.map((row) => row.questionBankId)));
    const actualRows = bankIds.length
      ? await groupingRepo.find({
          where: { questionBankId: In(bankIds) },
          select: ['questionBankId', 'externalId', 'groupKey', 'position'],
          order: {
            questionBankId: 'ASC',
            groupKey: 'ASC',
            position: 'ASC',
            externalId: 'ASC',
          },
        })
      : [];

    const expectedMap = new Map(
      expectedRows.map((row) => [
        `${row.questionBankId}|${row.externalId}|${row.groupKey}|${row.position}`,
        row,
      ]),
    );
    const actualMap = new Map(
      actualRows.map((row) => [
        `${row.questionBankId}|${row.externalId}|${row.groupKey}|${row.position}`,
        row,
      ]),
    );

    const missingInDb = expectedRows.filter(
      (row) => !actualMap.has(`${row.questionBankId}|${row.externalId}|${row.groupKey}|${row.position}`),
    );
    const extraInDb = actualRows
      .filter((row) => !expectedMap.has(`${row.questionBankId}|${row.externalId}|${row.groupKey}|${row.position}`))
      .map((row) => ({
        questionBankId: row.questionBankId,
        questionBankCode: banks.find((bank) => bank.id === row.questionBankId)?.code || 'UNKNOWN',
        externalId: row.externalId,
        groupKey: row.groupKey,
        position: row.position,
      }));

    console.log(
      JSON.stringify(
        {
          success: missingInDb.length === 0 && extraInDb.length === 0,
          jsonPath,
          bankMapPath,
          missingMappings,
          unknownBankCodes,
          totals: {
            sourcesChecked: sourceEntries.length,
            expectedRows: expectedRows.length,
            actualRows: actualRows.length,
            missingInDb: missingInDb.length,
            extraInDb: extraInDb.length,
          },
          summary,
          missingInDb,
          extraInDb,
        },
        null,
        2,
      ),
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((err) => {
  console.error(err);
  usage();
});
