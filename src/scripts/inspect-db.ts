/**
 * Usage: node --require ts-node/register src/scripts/inspect-db.ts <db-path>
 */
import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';

const dbPath = process.argv[2];
const tableName = process.argv[3];
if (!dbPath) { console.error('Usage: inspect-db.ts <db-path> [table-name]'); process.exit(1); }

const db = new sqlite3.Database(path.resolve(dbPath));
const all = promisify(db.all.bind(db));

async function main() {
  if (!tableName) {
    const tables = await all("SELECT name FROM sqlite_master WHERE type='table'") as any[];
    console.log('\n📋 Tables present:', tables.map(t => t.name).join(', '));
    db.close();
    return;
  }

  // Schema for specific table
  const cols = (await all(`PRAGMA table_info(${tableName})`) as any[]).map(r => r.name);
  console.log(`\n📋 ${tableName} columns:`, cols.join(', '));

  // Counts
  const [{ total }] = await all(`SELECT COUNT(*) as total FROM ${tableName}`) as any[];
  console.log(`\n📊 Rows in ${tableName}: ${total}`);

  // Sample data
  const samples = await all(`SELECT * FROM ${tableName} LIMIT 3`) as any[];
  console.log(`\n📄 Sample data from ${tableName}:`);
  console.log(JSON.stringify(samples, null, 2));

  db.close();
}

main().catch(e => { console.error('💥', e.message); db.close(); process.exit(1); });
