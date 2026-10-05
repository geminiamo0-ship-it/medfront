import * as fs from 'fs';
import * as path from 'path';

function parseArg(flag: string): string | null {
  const idx = process.argv.findIndex((arg) => arg === flag || arg.startsWith(flag + '='));
  if (idx === -1) return null;
  const arg = process.argv[idx];
  if (arg.includes('=')) return arg.split('=').slice(1).join('=');
  const next = process.argv[idx + 1];
  return next && !next.startsWith('--') ? next : null;
}

function usage(): never {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  npm run gen:question-groupings-bank-map -- --json="question_groupings (1).json" --out="bank-map.generated.json"',
      '',
      'Notes:',
      '  - Output is a JSON mapping: { "<sourcePath>": "<questionBankCode>" }',
      '  - Values are left empty ("") for you to fill with real question_banks.code.',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  const jsonArg = parseArg('--json') || 'question_groupings (1).json';
  const outArg = parseArg('--out') || 'bank-map.generated.json';

  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(process.cwd(), jsonArg);
  if (!fs.existsSync(jsonPath)) {
    // eslint-disable-next-line no-console
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    // eslint-disable-next-line no-console
    console.error('Expected legacy source-keyed JSON format: { "<sourcePath>": { ... }, ... }');
    usage();
  }

  const sources = Object.keys(parsed).sort((a, b) => a.localeCompare(b));
  const map: Record<string, string> = {};
  for (const source of sources) {
    map[source] = '';
  }

  const outPath = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg);
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${sources.length} mappings to ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

