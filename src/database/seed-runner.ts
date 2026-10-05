import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedDatabase } from './seed';

// Load environment variables
config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/entities/**/*.entity.ts'],
  synchronize: true, // We run this manually after setting session variables
  logging: true,
  ssl: process.env.DB_SSL_MODE === 'verify-full' ? {
    rejectUnauthorized: true,
  } : false,
});

async function runSeed() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    // Set CockroachDB to use sequential IDs for this session
    // This MUST be done before create table (synchronize)
    await AppDataSource.query("SET serial_normalization = 'sql_sequence';");
    console.log('🔢 Configured sequential ID generation');

    // Clear data without dropping tables
    console.log('🧹 Clearing existing data (preserving tables)...');
    const tables = [
      'contest_participants',
      'contest_submissions',
      'contest_questions',
      'contests',
      'question_options',
      'question_submissions',
      'question_interactions',
      'questions',
      'topics',
      'systems',
      'subjects',
      'question_banks',
      'user_preferences',
      'notebook_entries',
      'messages',
      'users'
    ];

    for (const table of tables) {
      try {
        await AppDataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (e) {
        // Table might not exist yet, ignore
      }
    }
    console.log('✅ Database cleared!');

    console.log('\n🌱 Running seed script...\n');
    await seedDatabase(AppDataSource);

    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runSeed();
