/**
 * ============================================================
 *  MedPark – Library Articles Importer (v3)
 * ============================================================
 *  Reads from: SQLite → library_articles
 *  Writes to : PostgreSQL → library_articles
 *
 *  Usage:
 *    npm run import:library-articles
 *    npm run import:library-articles -- --source=pastest --library-name=pastest
 *    npm run import:library-articles -- --db="path/to/db" --source=pastest
 * ============================================================
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DataSource } from "typeorm";
import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const customPath = args.find((a) => a.startsWith("--db="))?.split("=")[1];
const DB_PATH = customPath ? path.resolve(process.cwd(), customPath) : path.resolve(process.cwd(), "all_db/Library/my_course_bank.db");
const fallbackQbank = args.find((a) => a.startsWith("--qbank="))?.split("=")[1] || null;
const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1] || "usmle";
const libraryNameArg = args.find((a) => a.startsWith("--library-name="))?.split("=")[1] || null;
const CHUNK_SIZE = 100;

// ── SQLite helper (pure callback → Promise, no promisify issues) ──────────────
function openDb(dbPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require("sqlite3");
    const db = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READONLY,
      (err: any) => {
        if (err) reject(err);
        else resolve(db);
      },
    );
  });
}

function dbAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbClose(db: any): Promise<void> {
  return new Promise((resolve) => db.close(() => resolve()));
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ SQLite not found: ${DB_PATH}`);
    process.exit(1);
  }

  console.log("\n" + "═".repeat(64));
  console.log("  📚  MedPark – Library Articles Importer v3");
  console.log("═".repeat(64));
  console.log(`  Source DB   : ${DB_PATH}`);
  console.log(`  Source tag  : ${sourceArg}`);
  console.log(`  Library name: ${libraryNameArg || "(none)"}`);
  console.log(`  Fallback QB : ${fallbackQbank || "(none)"}`);
  console.log("═".repeat(64));

  // ── 1. Read SQLite ─────────────────────────────────────────────────────
  let db: any;
  let allRows: any[];

  try {
    db = await openDb(DB_PATH);

    // Inspect actual columns
    const cols = await dbAll(db, "PRAGMA table_info(library_articles)");
    const colNames: string[] = cols.map((c) => c.name);
    console.log(`\n📋 SQLite columns : ${colNames.join(", ")}`);

    // Auto-detect column names
    const titleCol =
      colNames.find((c) => ["title", "name"].includes(c)) ?? null;
    const contentCol =
      colNames.find((c) =>
        ["body_html", "content_html", "content"].includes(c),
      ) ?? null;
    const qbankCol =
      colNames.find((c) => ["qbank", "q_bank"].includes(c)) ?? null;
    const topicCol =
      colNames.find((c) => ["topic", "subject", "category"].includes(c)) ??
      null;
    const externalIdCol =
      colNames.find((c) => ["external_id"].includes(c)) ?? null;
    const externalCallerCol =
      colNames.find((c) => ["external_caller"].includes(c)) ?? null;
    const libraryNameCol =
      colNames.find((c) => ["library_name"].includes(c)) ?? null;

    if (!titleCol || !contentCol) {
      console.error(
        `❌ Could not detect title/content columns! Found: ${colNames.join(", ")}`,
      );
      await dbClose(db);
      process.exit(1);
    }

    console.log(`   Title           → ${titleCol}`);
    console.log(`   Content         → ${contentCol}`);
    console.log(`   QBank           → ${qbankCol ?? "(none)"}`);
    console.log(`   Topic           → ${topicCol ?? "(none)"}`);
    console.log(`   External ID     → ${externalIdCol ?? "(none)"}`);
    console.log(`   External Caller → ${externalCallerCol ?? "(none)"}`);
    console.log(`   Library Name    → ${libraryNameCol ?? "(none)"}`);

    allRows = await dbAll(db, "SELECT * FROM library_articles");
    await dbClose(db);

    console.log(`\n🔍 Found ${allRows.length} rows in SQLite.`);

    // Sample row for debugging
    const sample = allRows.find(
      (r) => r[titleCol] && String(r[titleCol]).trim(),
    );
    if (sample) {
      console.log(`\n📄 Sample Row:`);
      console.log(`   Title: ${sample[titleCol]}`);
      console.log(`   Topic: ${topicCol ? sample[topicCol] : "N/A"}`);
      console.log(`   QBank: ${qbankCol ? sample[qbankCol] : "N/A"}`);
      if (externalIdCol) console.log(`   External ID: ${sample[externalIdCol]}`);
      if (externalCallerCol) console.log(`   External Caller: ${sample[externalCallerCol]}`);
      if (libraryNameCol) console.log(`   Library Name: ${sample[libraryNameCol]}`);
    }

    // ── 2. Boot NestJS ──────────────────────────────────────────────────
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error"],
    });
    const ds = app.get(DataSource);

    // ── 3. Filter to only valid rows ───────────────────────────────
    const newRows = allRows.filter((r) => {
      const title = String(r[titleCol] ?? "").trim();
      return title.length > 0;
    });
    console.log(`➕ Processing ${newRows.length} articles...\n`);

    if (newRows.length === 0) {
      console.log("✅ Nothing to import.\n");
      await app.close();
      return;
    }

    // ── 4. Deduplicate by (source, name) — keep last occurrence ──
    // MUST match the DB unique index (source, name) and the ON CONFLICT target
    // below. Keying on category too would let two same-name/different-category
    // rows both survive into one batch, which Postgres rejects with
    // "ON CONFLICT DO UPDATE command cannot affect row a second time".
    const seen = new Map<string, number>();
    for (let i = 0; i < newRows.length; i++) {
      const title = String(newRows[i][titleCol]).trim();
      const key = `${sourceArg}\0${title}`;
      seen.set(key, i);
    }
    const dedupedRows = Array.from(seen.values()).map((i) => newRows[i]);
    const skippedDupes = newRows.length - dedupedRows.length;
    if (skippedDupes > 0) {
      console.log(`⚠️  Skipped ${skippedDupes} duplicate rows from source.`);
    }
    console.log(`➕ Upserting ${dedupedRows.length} unique articles...\n`);

    // ── 5. Batch UPSERT using (source, name, category) ─────────────────
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < dedupedRows.length; i += CHUNK_SIZE) {
      const chunk = dedupedRows.slice(i, i + CHUNK_SIZE);
      const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
      const totalBatches = Math.ceil(dedupedRows.length / CHUNK_SIZE);

      try {
        const placeholders: string[] = [];
        const params: any[] = [];
        let idx = 1;

        for (const row of chunk) {
          const title = String(row[titleCol]).trim();
          const content = String(row[contentCol] ?? "");
          const qbank = qbankCol && row[qbankCol] ? String(row[qbankCol]).trim() : fallbackQbank;
          const topic = topicCol
            ? String(row[topicCol] ?? "").trim()
            : "General";
          const category = topic || "General";
          const externalId = externalIdCol && row[externalIdCol] != null ? String(row[externalIdCol]).trim() : null;
          const externalCaller = externalCallerCol && row[externalCallerCol] != null ? String(row[externalCallerCol]).trim() : null;
          const libName = libraryNameCol && row[libraryNameCol] != null ? String(row[libraryNameCol]).trim() : libraryNameArg;

          placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
          params.push(title, category, content, qbank, sourceArg, externalId, externalCaller, libName);
        }

        await ds.query(
          `INSERT INTO library_articles (name, category, content_html, qbank, source, external_id, external_caller, library_name)
           VALUES ${placeholders.join(", ")}
           ON CONFLICT (source, name)
           DO UPDATE SET
             category = EXCLUDED.category,
             content_html = EXCLUDED.content_html,
             qbank = EXCLUDED.qbank,
             external_id = COALESCE(EXCLUDED.external_id, library_articles.external_id),
             external_caller = COALESCE(EXCLUDED.external_caller, library_articles.external_caller),
             library_name = COALESCE(EXCLUDED.library_name, library_articles.library_name)`,
          params,
        );

        imported += chunk.length;
        console.log(
          `  ✅ Batch ${batchNum}/${totalBatches} — ${imported}/${newRows.length} upserted`,
        );
      } catch (e: any) {
        errors += chunk.length;
        console.error(
          `  ❌ Batch ${batchNum}/${totalBatches} FAILED: ${e.message}`,
        );
      }
    }

    // ── 5. Summary ────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(64));
    console.log("  📊  LIBRARY IMPORT COMPLETE");
    console.log("═".repeat(64));
    console.log(`  ✅ Upserted : ${imported}`);
    console.log(`  ❌ Errors   : ${errors}`);
    console.log("═".repeat(64) + "\n");

    await app.close();
  } catch (err: any) {
    console.error("💥 Fatal:", err.message ?? err);
    if (db) await dbClose(db).catch(() => {});
    process.exit(1);
  }
}

main();
