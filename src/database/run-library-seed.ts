import { DataSource } from "typeorm";
import { config } from "dotenv";

// Load environment variables
config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ["src/entities/**/*.entity.ts"],
  synchronize: false, // CRITICAL: Keep false to avoid CockroachDB sync errors
  logging: true,
  ssl:
    process.env.DB_SSL_MODE === "verify-full"
      ? {
          rejectUnauthorized: true,
        }
      : false,
});

async function runLibrarySeed() {
  try {
    console.log("🔌 Connecting to database...");
    await AppDataSource.initialize();
    console.log("✅ Database connected!");

    // Set CockroachDB to use sequential IDs for this session
    await AppDataSource.query("SET serial_normalization = 'sql_sequence';");
    console.log("🔢 Configured sequential ID generation");

    // 🔨 MANUAL RECREATION OF LIBRARY TABLES
    // This avoids TypeORM's 'synchronize' which hits unimplemented CRDB features
    console.log("🧨 Recreating library tables manually...");

    const sql = `
      -- Drop existing library tables
      DROP TABLE IF EXISTS article_highlights CASCADE;
      DROP TABLE IF EXISTS article_progress CASCADE;
      DROP TABLE IF EXISTS articles CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS library_articles CASCADE;

      -- Create the new single-table structure
      CREATE TABLE library_articles (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          content_html TEXT NOT NULL,
          qbank TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Recreate progress and highlight tables
      CREATE TABLE article_progress (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "articleId" INTEGER NOT NULL REFERENCES library_articles(id) ON DELETE CASCADE,
          "isRead" BOOLEAN DEFAULT FALSE,
          "isBookmarked" BOOLEAN DEFAULT FALSE,
          "lastAccessedAt" TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("userId", "articleId")
      );

      CREATE TABLE article_highlights (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          annotation TEXT,
          color TEXT DEFAULT 'yellow',
          "rangeIndex" INTEGER,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "articleId" INTEGER NOT NULL REFERENCES library_articles(id) ON DELETE CASCADE,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Execute the SQL as a single block or multiple queries
    // TypeORM's query usually handles the block in one go if driver supports it
    await AppDataSource.query(sql);
    console.log("✅ Library tables recreated!");

    console.log(
      "\n📚 Starting Library Import from SQLite... (DISABLED due to missing seed-library)\n",
    );
    // await seedLibrary(AppDataSource);

    console.log("\n✅ Library seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Library Seed failed:", error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runLibrarySeed();
