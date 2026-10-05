import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { QuestionBank } from '../entities/question-bank.entity';

/**
 * Seed the per-bank subject/system ORDER + column layout for UWORLD_S1 from
 * UWORLD_S1_reorder.json. Idempotent REPLACE — deletes every existing override
 * row for the bank and re-inserts the current JSON's rows in one transaction,
 * so re-running after EDITING the JSON (removing a name, moving one between
 * columns) leaves exactly what the JSON says, with no stale rows left pinning a
 * dropped subject/system. Safe to re-run.
 *
 * Run:
 *   npm run seed:uworld-s1-order
 *   (or) $env:TYPEORM_ENTITIES='ts'; npx ts-node -r tsconfig-paths/register \
 *          src/scripts/seed-uworld-s1-order.ts
 */

config();

const BANK_CODE = 'UWORLD_S1';
const JSON_FILE = 'UWORLD_S1_reorder.json';

type ReorderJson = {
  subjects?: { column_1?: string[]; column_2?: string[] };
  systems?: { column_1?: string[]; column_2?: string[] };
};

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

async function main() {
  const jsonPath = path.isAbsolute(JSON_FILE)
    ? JSON_FILE
    : path.join(process.cwd(), JSON_FILE);
  if (!fs.existsSync(jsonPath)) {
    // eslint-disable-next-line no-console
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ReorderJson;

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    // Glob all entities so relation metadata (e.g. System#topics) resolves —
    // the seed itself talks to the DB via raw SQL, but TypeORM still builds the
    // full metadata graph at initialize() time.
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
    logging: false,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await dataSource.initialize();

  try {
    // ── Resolve the bank ──────────────────────────────────────────────────
    const bank = await dataSource
      .getRepository(QuestionBank)
      .findOne({ where: { code: BANK_CODE } });
    if (!bank) {
      // eslint-disable-next-line no-console
      console.error(`Question bank with code "${BANK_CODE}" not found. Aborting.`);
      process.exit(1);
    }
    const bankId = bank.id;
    log(`Bank "${BANK_CODE}" → id ${bankId} (step ${bank.step})`);

    // ── The bank's ACTUAL active taxonomy (id + name) ─────────────────────
    // The override is only meaningful for subjects/systems the bank actually
    // uses (metadata derives them from the bank's questions). Matching JSON
    // names against THIS set — not the global tables — guarantees we pick the
    // id the bank really uses and sidesteps case-insensitive duplicate names
    // elsewhere in the global tables (e.g. "Dermatology" id 4 vs "DERMATOLOGY"
    // id 174, where only id 4 carries this bank's questions).
    const bankSubjectRows: Array<{ id: number; name: string }> = await dataSource.query(
      `SELECT DISTINCT s.id, s.name
         FROM questions q
         JOIN subjects s ON s.id = q."subjectId"
        WHERE q."questionBankId" = $1 AND q."isActive" = true AND s."isActive" = true`,
      [bankId],
    );
    const bankSystemRows: Array<{ id: number; name: string }> = await dataSource.query(
      `SELECT DISTINCT sy.id, sy.name
         FROM questions q
         JOIN systems sy ON sy.id = q."systemId"
        WHERE q."questionBankId" = $1 AND q."isActive" = true AND sy."isActive" = true`,
      [bankId],
    );

    const nameKey = (n: unknown) => String(n ?? '').trim().toLowerCase();
    // Build a case-insensitive name → [ids] index over the bank's taxonomy.
    // Normally one id per name; a >1 list means the bank genuinely uses two
    // active same-named rows (flagged as ambiguous below, lowest id wins).
    function buildNameIndex(taxonomy: Array<{ id: number; name: string }>) {
      const map = new Map<string, number[]>();
      for (const row of taxonomy) {
        const key = nameKey(row.name);
        const ids = map.get(key) ?? [];
        ids.push(Number(row.id));
        map.set(key, ids);
      }
      for (const ids of map.values()) ids.sort((a, b) => a - b); // deterministic tie-break
      return map;
    }
    const subjectIndex = buildNameIndex(bankSubjectRows);
    const systemIndex = buildNameIndex(bankSystemRows);

    // ── Generic column → rows resolver ────────────────────────────────────
    // For a { column_1: [...], column_2: [...] } block, resolve each name
    // against the bank's taxonomy index and produce { id, columnIndex,
    // position } rows. 0 matches → unmatched; >1 → ambiguous (lowest id used).
    function resolve(
      block: { column_1?: string[]; column_2?: string[] } | undefined,
      index: Map<string, number[]>,
    ): {
      rows: Array<{ id: number; columnIndex: number; position: number }>;
      unmatched: string[];
      ambiguous: string[];
      totalJson: number;
      matchedIds: Set<number>;
    } {
      const rows: Array<{ id: number; columnIndex: number; position: number }> = [];
      const unmatched: string[] = [];
      const ambiguous: string[] = [];
      const matchedIds = new Set<number>();
      let totalJson = 0;

      const columns: Array<[number, string[]]> = [
        [1, block?.column_1 ?? []],
        [2, block?.column_2 ?? []],
      ];

      for (const [columnIndex, names] of columns) {
        for (let i = 0; i < names.length; i++) {
          const rawName = names[i];
          totalJson++;
          const ids = index.get(nameKey(rawName)) ?? [];
          if (ids.length === 0) {
            unmatched.push(rawName);
            continue;
          }
          if (ids.length > 1) {
            ambiguous.push(`${String(rawName)} → ids [${ids.join(', ')}], using ${ids[0]}`);
          }
          const id = ids[0];
          matchedIds.add(id);
          rows.push({ id, columnIndex, position: i });
        }
      }
      return { rows, unmatched, ambiguous, totalJson, matchedIds };
    }

    const subjectRes = resolve(parsed.subjects, subjectIndex);
    const systemRes = resolve(parsed.systems, systemIndex);

    // ── Replace the bank's rows (atomic, truly idempotent) ─────────────────
    // Delete every existing row for this bank, then insert the current JSON's
    // rows — all in ONE transaction. A bare upsert would leave orphan rows for
    // names removed from the JSON (they'd keep pinning a subject/system that
    // should have fallen back to global order); delete-then-insert reflects
    // removals/moves and keeps the layout atomically consistent on failure.
    // ON CONFLICT is kept only to tolerate two JSON names resolving to the same
    // taxonomy id within a single run (post-delete it never fires otherwise).
    const countRows = async (table: string) =>
      Number(
        (
          await dataSource.query(
            `SELECT COUNT(*)::int AS c FROM ${table} WHERE question_bank_id = $1`,
            [bankId],
          )
        )[0]?.c ?? 0,
      );
    const priorSubjectCount = await countRows('question_bank_subject_order');
    const priorSystemCount = await countRows('question_bank_system_order');

    await dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM question_bank_subject_order WHERE question_bank_id = $1`,
        [bankId],
      );
      await manager.query(
        `DELETE FROM question_bank_system_order WHERE question_bank_id = $1`,
        [bankId],
      );
      for (const r of subjectRes.rows) {
        await manager.query(
          `INSERT INTO question_bank_subject_order
             (question_bank_id, subject_id, column_index, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (question_bank_id, subject_id)
           DO UPDATE SET column_index = EXCLUDED.column_index,
                         position = EXCLUDED.position`,
          [bankId, r.id, r.columnIndex, r.position],
        );
      }
      for (const r of systemRes.rows) {
        await manager.query(
          `INSERT INTO question_bank_system_order
             (question_bank_id, system_id, column_index, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (question_bank_id, system_id)
           DO UPDATE SET column_index = EXCLUDED.column_index,
                         position = EXCLUDED.position`,
          [bankId, r.id, r.columnIndex, r.position],
        );
      }
    });

    // ── Coverage: the bank's ACTUAL active subjects/systems ───────────────
    // (bankSubjectRows / bankSystemRows were fetched above to build the match
    // index; reuse them here to find taxonomy present in the bank but absent
    // from the JSON.)
    const subjectGaps = bankSubjectRows.filter((r) => !subjectRes.matchedIds.has(Number(r.id)));
    const systemGaps = bankSystemRows.filter((r) => !systemRes.matchedIds.has(Number(r.id)));

    // ── Report ────────────────────────────────────────────────────────────
    const line = '─'.repeat(70);
    log(`\n${line}`);
    log(`SEED REPORT — bank ${BANK_CODE} (id ${bankId})`);
    log(line);

    log(
      `\nSubjects: matched ${subjectRes.rows.length}/${subjectRes.totalJson} JSON entries → ` +
        `replaced ${priorSubjectCount} prior row(s) with ${subjectRes.rows.length}.`,
    );
    log(
      `Systems:  matched ${systemRes.rows.length}/${systemRes.totalJson} JSON entries → ` +
        `replaced ${priorSystemCount} prior row(s) with ${systemRes.rows.length}.`,
    );

    log(`\n── UNMATCHED JSON NAMES (in JSON, no DB row — FIX THESE) ──`);
    if (subjectRes.unmatched.length === 0 && systemRes.unmatched.length === 0) {
      log('  (none — every JSON name matched a DB row)');
    } else {
      if (subjectRes.unmatched.length) {
        log(`  Subjects (${subjectRes.unmatched.length}):`);
        subjectRes.unmatched.forEach((n) => log(`    - ${JSON.stringify(n)}`));
      }
      if (systemRes.unmatched.length) {
        log(`  Systems (${systemRes.unmatched.length}):`);
        systemRes.unmatched.forEach((n) => log(`    - ${JSON.stringify(n)}`));
      }
    }

    log(`\n── AMBIGUOUS NAMES (bank has >1 active row for this name — lowest id used) ──`);
    if (subjectRes.ambiguous.length === 0 && systemRes.ambiguous.length === 0) {
      log('  (none — every matched name resolved to a single bank taxonomy id)');
    } else {
      if (subjectRes.ambiguous.length) {
        log(`  Subjects (${subjectRes.ambiguous.length}):`);
        subjectRes.ambiguous.forEach((n) => log(`    - ${n}`));
      }
      if (systemRes.ambiguous.length) {
        log(`  Systems (${systemRes.ambiguous.length}):`);
        systemRes.ambiguous.forEach((n) => log(`    - ${n}`));
      }
    }

    log(`\n── COVERAGE GAPS (in the bank, NOT in the JSON — will fall back to global order) ──`);
    if (subjectGaps.length === 0 && systemGaps.length === 0) {
      log('  (none — every active subject/system in the bank is covered by the JSON)');
    } else {
      if (subjectGaps.length) {
        log(`  Subjects (${subjectGaps.length}):`);
        subjectGaps.forEach((r) => log(`    - ${JSON.stringify(r.name)} (id ${r.id})`));
      }
      if (systemGaps.length) {
        log(`  Systems (${systemGaps.length}):`);
        systemGaps.forEach((r) => log(`    - ${JSON.stringify(r.name)} (id ${r.id})`));
      }
    }

    log(`\n${line}\nDone.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
