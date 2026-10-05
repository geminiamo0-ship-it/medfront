import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminQuestionGroupingsService } from '../admin/admin-question-groupings.service';
import * as fs from 'fs';
import * as path from 'path';
// npm run import:question-groupings -- --json="question_groupings (1).json" --bankMap="bank-map.json" --dryRun=false

function disableOptionalInfraForScripts() {
  // These scripts don't need cache warmups or Redis connections. Disabling them
  // makes the script faster and prevents noisy/unrelated failures.
  process.env.LIBRARY_CACHE_WARM = 'false';
  process.env.LIBRARY_CACHE_WARM_SOURCE = '';
  process.env.REDIS_HOST = '';
  process.env.REDIS_PORT = '';
  process.env.REDIS_PASSWORD = '';
  process.env.REDIS_PREFIX = '';
}

function parseArg(flag: string): string | null {
  const idx = process.argv.findIndex((arg) => arg === flag || arg.startsWith(flag + '='));
  if (idx === -1) return null;
  const arg = process.argv[idx];
  if (arg.includes('=')) return arg.split('=').slice(1).join('=');
  const next = process.argv[idx + 1];
  return next && !next.startsWith('--') ? next : null;
}

function parseLegacyFormatPerSource(json: any): Record<string, Array<Array<string | number>>> {
  // legacy format:
  // {
  //   "<sourcePath>": { "<id>": [id1, id2, ...], ... },
  //   ...
  // }
  const groupsBySource: Record<string, Array<Array<string | number>>> = {};
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

    // Some legacy sources contain overlapping arrays (e.g. chain-like pairs).
    // To make atomic sets, merge all overlapping arrays into connected components.
    // Ordering inside the final group is by numeric externalId ASC (stable + sequential).
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

    const groups: Array<Array<string | number>> = [];
    for (const members of rootToMembers.values()) {
      const sorted = Array.from(members).sort((a, b) => Number(a) - Number(b));
      if (sorted.length >= 2) groups.push(sorted);
    }

    groupsBySource[sourcePath] = groups;
  }
  return groupsBySource;
}

async function bootstrap() {
  const bankCode = parseArg('--bankCode');
  const bankMapPathArg = parseArg('--bankMap');
  const onlySource = parseArg('--onlySource');
  const jsonPathArg = parseArg('--json') || 'question_groupings (1).json';
  const dryRun = (parseArg('--dryRun') ?? 'true').toLowerCase() === 'true';
  const replaceExisting = (parseArg('--replaceExisting') ?? 'true').toLowerCase() === 'true';

  disableOptionalInfraForScripts();

  const jsonPath = path.isAbsolute(jsonPathArg)
    ? jsonPathArg
    : path.join(process.cwd(), jsonPathArg);

  if (!fs.existsSync(jsonPath)) {
    // eslint-disable-next-line no-console
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  const isArrayFormat = Array.isArray(parsed);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const service = app.get(AdminQuestionGroupingsService);

  if (isArrayFormat) {
    if (!bankCode) {
      // eslint-disable-next-line no-console
      console.error('Array JSON format requires --bankCode=QUESTION_BANK_CODE');
      process.exit(1);
    }

    const groups = parsed as Array<Array<string | number>>;
    const result = await service.importGroupings({
      questionBankCode: bankCode,
      groups,
      dryRun,
      replaceExisting,
    } as any);

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    await app.close();
    return;
  }

  const groupsBySource = parseLegacyFormatPerSource(parsed);
  if (Object.keys(groupsBySource).length === 0) {
    // eslint-disable-next-line no-console
    console.error('No groupings found in legacy JSON.');
    process.exit(1);
  }

  if (!bankMapPathArg) {
    // eslint-disable-next-line no-console
    console.error(
      'Legacy source-keyed JSON requires --bankMap=PATH_TO_JSON (mapping sourcePath -> questionBankCode).',
    );
    process.exit(1);
  }

  const bankMapPath = path.isAbsolute(bankMapPathArg)
    ? bankMapPathArg
    : path.join(process.cwd(), bankMapPathArg);
  if (!fs.existsSync(bankMapPath)) {
    // eslint-disable-next-line no-console
    console.error(`Bank map JSON not found: ${bankMapPath}`);
    process.exit(1);
  }

  const bankMapRaw = fs.readFileSync(bankMapPath, 'utf8');
  const bankMap = JSON.parse(bankMapRaw) as Record<string, string>;

  const sources = Object.keys(groupsBySource)
    .filter((source) => (onlySource ? source === onlySource : true))
    .sort((a, b) => a.localeCompare(b));

  const results: any[] = [];
  for (const sourcePath of sources) {
    const mappedBankCode = bankMap[sourcePath];
    if (!mappedBankCode) {
      results.push({
        sourcePath,
        success: false,
        error: 'missing_bank_mapping',
      });
      continue;
    }

    const groups = groupsBySource[sourcePath];
    try {
      const result = await service.importGroupings({
        questionBankCode: mappedBankCode,
        groups,
        dryRun,
        replaceExisting,
      } as any);
      results.push({ sourcePath, questionBankCode: mappedBankCode, ...result });
    } catch (err: any) {
      results.push({
        sourcePath,
        questionBankCode: mappedBankCode,
        success: false,
        error: err?.message || String(err),
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ success: true, data: results }, null, 2));
  await app.close();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
