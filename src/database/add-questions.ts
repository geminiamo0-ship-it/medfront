import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedManyQuestions } from './seed-questions';

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
});

async function addQuestions() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Connected!\n');

    // Get existing IDs
    const subjects = await AppDataSource.query('SELECT id FROM subjects');
    const systems = await AppDataSource.query('SELECT id FROM systems');
    const topics = await AppDataSource.query('SELECT id FROM topics');
    const questionBanks = await AppDataSource.query('SELECT id FROM question_banks WHERE code = $1', ['UWORLD']);

    if (!questionBanks.length) {
      console.error('❌ No question bank found!');
      process.exit(1);
    }

    console.log(`📊 Found: ${subjects.length} subjects, ${systems.length} systems, ${topics.length} topics\n`);

    await seedManyQuestions(
      AppDataSource,
      subjects.map((s: any) => s.id),
      systems.map((s: any) => s.id),
      topics.map((t: any) => t.id),
      questionBanks[0].id
    );

    const count = await AppDataSource.query('SELECT COUNT(*) as count FROM questions');
    console.log(`\n✅ Total questions in database: ${count[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

addQuestions();
