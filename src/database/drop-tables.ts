import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/entities/**/*.entity.ts'],
  synchronize: false,
  logging: false,
  ssl: process.env.DB_SSL_MODE === 'verify-full' ? {
    rejectUnauthorized: true,
  } : false,
});

async function nuclearWipe() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    // 1. Drop all tables with CASCADE
    console.log('🔍 Fetching all tables in public schema...');
    const tables = await AppDataSource.query(`
      SELECT tablename FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
    `);
    
    console.log(`📋 Found ${tables.length} tables to drop.`);
    for (const t of tables) {
      console.log(`🗑️  Dropping table ${t.tablename}...`);
      await AppDataSource.query(`DROP TABLE IF EXISTS "${t.tablename}" CASCADE`);
    }

    // 2. Drop all custom types/enums
    console.log('🔍 Fetching all enums...');
    const enums = await AppDataSource.query(`
      SELECT t.typname FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    `);
    
    for (const e of enums) {
      console.log(`🗑️  Dropping enum ${e.typname}...`);
      try {
        await AppDataSource.query(`DROP TYPE IF EXISTS "${e.typname}" CASCADE`);
      } catch (err) {
        console.log(`⚠️  Could not drop enum ${e.typname} (might be gone)`);
      }
    }

    console.log('\n✅ Database is now clinically clean!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Wipe failed:', error);
    process.exit(1);
  }
}

nuclearWipe();
