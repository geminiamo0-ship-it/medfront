import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';

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
  logging: true,
});

async function fixUsers() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Connected!\n');

    const userRepo = AppDataSource.getRepository(User);
    const emails = ['admin@medpark.com', 'student@medpark.com', 'premium@medpark.com'];
    
    for (const email of emails) {
      const user = await userRepo.findOne({ where: { email } });
      if (user) {
        console.log(`🔧 Resetting password for ${email}...`);
        user.password = 'password123';
        await userRepo.save(user); // This will trigger @BeforeUpdate and hash it ONCE
      }
    }

    console.log('\n✅ User passwords reset successfully!');
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

fixUsers();
