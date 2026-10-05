import 'dotenv/config';
import { DataSource } from 'typeorm';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'medpark-dev',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await ds.initialize();

  // Check for duplicate articles by name+category
  const dupes = await ds.query(`
    SELECT name, category, source, COUNT(*) as cnt
    FROM library_articles
    WHERE source = 'usmle'
    GROUP BY name, category, source
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('=== Duplicate articles (same name+category) ===');
  console.log(JSON.stringify(dupes, null, 2));
  console.log(`Found ${dupes.length} duplicate groups`);

  // Total count
  const total = await ds.query(`SELECT COUNT(*) as cnt FROM library_articles WHERE source = 'usmle'`);
  console.log(`\nTotal usmle articles: ${total[0].cnt}`);

  // Unique count
  const unique = await ds.query(`SELECT COUNT(*) as cnt FROM (SELECT DISTINCT name, category FROM library_articles WHERE source = 'usmle') t`);
  console.log(`Unique usmle articles: ${unique[0].cnt}`);

  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
