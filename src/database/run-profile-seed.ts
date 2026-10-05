import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { seedRealisticProfiles } from './seed-realistic-profiles';
import { User } from '../entities/user.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { Subject } from '../entities/subject.entity';
import { System } from '../entities/system.entity';
import { Topic } from '../entities/topic.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { Question } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { Contest } from '../entities/contest.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';

// Load environment variables
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [
    User,
    UserPreferences,
    Subject,
    System,
    Topic,
    QuestionBank,
    Question,
    QuestionOption,
    Contest,
    ContestParticipant,
  ],
  synchronize: false,
  ssl: process.env.DB_SSL_MODE === 'verify-full' ? {
    rejectUnauthorized: true,
  } : false,
});

async function runProfileSeeding() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    await seedRealisticProfiles(AppDataSource);

    console.log('\n🎉 Profile seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

runProfileSeeding();
