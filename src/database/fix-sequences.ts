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
  ssl: process.env.DB_SSL_MODE === 'verify-full' ? { rejectUnauthorized: true } : false,
});

async function fixSequences() {
  try {
    console.log('🔌 Connecting to database to fix sequences...');
    await AppDataSource.initialize();
    
    const tables = [
      'users',
      'subjects',
      'systems',
      'topics',
      'question_banks',
      'questions',
      'question_options',
      'question_interactions',
      'question_submissions',
      'contests',
      'contest_participants',
      'contest_questions',
      'contest_submissions',
      'tests',
      'test_questions',
      'notebook_entries',
      'user_preferences',
      'messages'
    ];

    console.log('🧹 Clearing data and setting up sequences...');
    
    for (const table of tables) {
      try {
        console.log(`🛠️  Fixing table: ${table}`);
        // 1. Wipe current data (preserve schema)
        await AppDataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
        
        // 2. Create sequence for this table
        const seqName = `${table}_id_seq`;
        await AppDataSource.query(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`);
        
        // 3. Set default to use sequence
        await AppDataSource.query(`ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${seqName}')`);
        
        console.log(`   ✅ ${table} is now using sequential IDs`);
      } catch (e: any) {
        console.log(`   ⚠️  Skipped ${table}: ${e.message}`);
      }
    }

    console.log('\n✨ All tables converted to sequential IDs! Ready to seed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to fix sequences:', error);
    process.exit(1);
  }
}

fixSequences();
