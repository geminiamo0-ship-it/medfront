/**
 * ============================================================
 *  MedPark – Amboss Library Importer
 * ============================================================
 *  Reads from: all_db/amboss_library/amboss_library.db
 *  Writes to : PostgreSQL -> library_articles + locations + tooltips
 *
 *  Usage:
 *    npm run import:amboss-library
 *    npm run import:amboss-library -- --clear-amboss
 * ============================================================
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DataSource } from "typeorm";
import * as fs from "fs";
import * as path from "path";

const DB_PATH = path.resolve(process.cwd(), "all_db/amboss_library/amboss_library.db");
const CHUNK_SIZE = 200;

function openDb(dbPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require("sqlite3");
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: any) => {
      if (err) reject(err);
      else resolve(db);
    });
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

function normalizePath(pathRaw: string) {
  const parts = String(pathRaw || "")
    .split(">")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts[0]?.toLowerCase() === "amboss library") {
    parts.shift();
  }
  return parts;
}

function derivePrimaryCategory(paths: string[]) {
  if (!paths.length) return "General";
  const preferred =
    paths.find((p) => !p.toLowerCase().includes("cme-eligible")) || paths[0];
  const parts = normalizePath(preferred);
  return parts[parts.length - 1] || "General";
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ SQLite not found: ${DB_PATH}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const shouldClear = args.includes("--clear-amboss");

  console.log("\n" + "═".repeat(64));
  console.log("  📚 MedPark – Amboss Library Importer");
  console.log("═".repeat(64));
  console.log(`  Source : ${DB_PATH}`);
  console.log(`  Clear  : ${shouldClear ? "YES" : "NO"}`);
  console.log("═".repeat(64));

  let db: any;

  try {
    db = await openDb(DB_PATH);

    const articles = await dbAll(
      db,
      "SELECT id, name, content_html, qbank, created_at FROM articles",
    );
    const locations = await dbAll(
      db,
      "SELECT article_id, category FROM article_locations",
    );
    const tooltips = await dbAll(db, "SELECT eid, abstract FROM tooltips");

    await dbClose(db);

    console.log(`\n🔍 Articles: ${articles.length}`);
    console.log(`🔍 Locations: ${locations.length}`);
    console.log(`🔍 Tooltips: ${tooltips.length}`);

    const pathsByArticleId = new Map<string, string[]>();
    for (const loc of locations) {
      const id = String(loc.article_id);
      const cat = String(loc.category || "").trim();
      if (!cat) continue;
      if (!pathsByArticleId.has(id)) pathsByArticleId.set(id, []);
      pathsByArticleId.get(id)?.push(cat);
    }

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error"],
    });
    const ds = app.get(DataSource);

    if (shouldClear) {
      console.log("\n🧹 Clearing Amboss library data...");
      await ds.query(
        `DELETE FROM library_article_locations WHERE "articleId" IN (SELECT id FROM library_articles WHERE source = 'amboss')`,
      );
      await ds.query(`DELETE FROM library_articles WHERE source = 'amboss'`);
      await ds.query(`DELETE FROM library_tooltips WHERE source = 'amboss'`);
    }

    console.log("\n➕ Importing Amboss articles...");
    for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
      const chunk = articles.slice(i, i + CHUNK_SIZE);
      const placeholders: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const row of chunk) {
        const externalId = String(row.id).trim();
        const name = String(row.name || "").trim();
        if (!name || !externalId) continue;
        const content = String(row.content_html || "");
        const qbank = row.qbank ? String(row.qbank) : null;
        const paths = pathsByArticleId.get(externalId) || [];
        const category = derivePrimaryCategory(paths);
        const externalCaller = row.external_caller != null ? String(row.external_caller).trim() : null;

        placeholders.push(
          `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
        );
        params.push(
          name,
          category,
          content,
          qbank,
          "amboss",
          externalId,
          externalCaller,
          "amboss",
        );
      }

      if (!placeholders.length) continue;

      await ds.query(
        `INSERT INTO library_articles (name, category, content_html, qbank, source, external_id, external_caller, library_name)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (source, external_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           content_html = EXCLUDED.content_html,
           qbank = EXCLUDED.qbank,
           external_caller = COALESCE(EXCLUDED.external_caller, library_articles.external_caller),
           library_name = EXCLUDED.library_name`,
        params,
      );

      const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
      const totalBatches = Math.ceil(articles.length / CHUNK_SIZE);
      console.log(`  ✅ Batch ${batchNum}/${totalBatches}`);
    }

    const ambossIds = await ds.query(
      `SELECT id, external_id FROM library_articles WHERE source = 'amboss'`,
    );
    const idMap = new Map<string, number>();
    for (const row of ambossIds) {
      if (row.external_id) idMap.set(String(row.external_id), Number(row.id));
    }

    console.log("\n➕ Importing category paths...");
    const locationRows: Array<[number, string]> = [];
    for (const loc of locations) {
      const extId = String(loc.article_id);
      const articleId = idMap.get(extId);
      if (!articleId) continue;
      const categoryPath = String(loc.category || "").trim();
      if (!categoryPath) continue;
      locationRows.push([articleId, categoryPath]);
    }

    for (let i = 0; i < locationRows.length; i += CHUNK_SIZE) {
      const chunk = locationRows.slice(i, i + CHUNK_SIZE);
      const placeholders: string[] = [];
      const params: any[] = [];
      let idx = 1;
      for (const [articleId, categoryPath] of chunk) {
        placeholders.push(`($${idx++}, $${idx++})`);
        params.push(articleId, categoryPath);
      }
      if (!placeholders.length) continue;
      await ds.query(
        `INSERT INTO library_article_locations ("articleId", "category_path")
         VALUES ${placeholders.join(", ")}
         ON CONFLICT DO NOTHING`,
        params,
      );
    }

    console.log("\n➕ Importing tooltips...");
    for (let i = 0; i < tooltips.length; i += CHUNK_SIZE) {
      const chunk = tooltips.slice(i, i + CHUNK_SIZE);
      const placeholders: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const tip of chunk) {
        const eid = String(tip.eid || "").trim();
        const abstract = String(tip.abstract || "").trim();
        if (!eid || !abstract) continue;
        placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
        params.push(eid, abstract, "amboss");
      }

      if (!placeholders.length) continue;

      await ds.query(
        `INSERT INTO library_tooltips (eid, abstract, source)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (eid)
         DO UPDATE SET
           abstract = EXCLUDED.abstract,
           source = EXCLUDED.source`,
        params,
      );
    }

    console.log("\n✅ Amboss import complete.");
    await app.close();
  } catch (err: any) {
    console.error("💥 Fatal:", err.message ?? err);
    if (db) await dbClose(db).catch(() => {});
    process.exit(1);
  }
}

main();
