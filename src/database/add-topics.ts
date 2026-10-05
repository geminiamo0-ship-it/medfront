import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Topic } from '../entities/topic.entity';
import { System } from '../entities/system.entity';
import { Subject } from '../entities/subject.entity';

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

async function addTopics() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    const topicRepo = AppDataSource.getRepository(Topic);
    const systemRepo = AppDataSource.getRepository(System);
    const subjectRepo = AppDataSource.getRepository(Subject);

    // Get existing data
    const internalMedicine = await subjectRepo.findOne({ where: { code: 'IM' } });
    const pediatrics = await subjectRepo.findOne({ where: { code: 'PED' } });
    
    const systems = await systemRepo.find();
    
    const topicsData = [];

    for (const system of systems) {
      let systemTopics = [];
      
      switch (system.code) {
        case 'RENAL':
          systemTopics = [
            { name: 'Glomerular diseases', subjectId: internalMedicine.id },
            { name: 'Cystic kidney diseases', subjectId: internalMedicine.id },
            { name: 'Neoplasms of kidney', subjectId: internalMedicine.id },
            { name: 'Chronic kidney disease', subjectId: internalMedicine.id },
            { name: 'Acute kidney injury', subjectId: internalMedicine.id },
          ];
          break;
        case 'CARDIO':
          systemTopics = [
            { name: 'Heart Failure', subjectId: internalMedicine.id },
            { name: 'Arrhythmias', subjectId: internalMedicine.id },
            { name: 'Valvular disease', subjectId: internalMedicine.id },
            { name: 'Congenital heart disease', subjectId: pediatrics.id },
          ];
          break;
        case 'GI':
          systemTopics = [
            { name: 'Esophageal disorders', subjectId: internalMedicine.id },
            { name: 'Peptic ulcer disease', subjectId: internalMedicine.id },
            { name: 'Inflammatory bowel disease', subjectId: internalMedicine.id },
          ];
          break;
        case 'RESP':
          systemTopics = [
            { name: 'Asthma', subjectId: internalMedicine.id },
            { name: 'COPD', subjectId: internalMedicine.id },
            { name: 'Pneumonia', subjectId: internalMedicine.id },
          ];
          break;
        case 'IMMUNO':
          systemTopics = [
            { name: 'Autoimmunity', subjectId: internalMedicine.id },
          ];
          break;
        case 'MSK':
          systemTopics = [
            { name: 'Arthritis', subjectId: internalMedicine.id },
            { name: 'Fractures', subjectId: internalMedicine.id },
          ];
          break;
        case 'ENDO':
          systemTopics = [
            { name: 'Diabetes mellitus', subjectId: internalMedicine.id },
            { name: 'Thyroid disorders', subjectId: internalMedicine.id },
          ];
          break;
        case 'HEMONC':
          systemTopics = [
            { name: 'Anemia', subjectId: internalMedicine.id },
            { name: 'Leukemia', subjectId: internalMedicine.id },
          ];
          break;
        case 'ID':
          systemTopics = [
            { name: 'Bacterial infections', subjectId: internalMedicine.id },
            { name: 'Viral infections', subjectId: internalMedicine.id },
          ];
          break;
      }

      for (let i = 0; i < systemTopics.length; i++) {
        const topicData = systemTopics[i];
        
        // Check if topic already exists
        const existing = await topicRepo.findOne({
          where: { name: topicData.name, systemId: system.id }
        });

        if (!existing) {
          topicsData.push({
            ...topicData,
            systemId: system.id,
            description: `Detailed study of ${topicData.name}`,
            displayOrder: i + 1,
            isActive: true,
          });
        }
      }
    }

    if (topicsData.length > 0) {
      await topicRepo.save(topicsData);
      console.log(`✅ Added ${topicsData.length} new topics`);
    } else {
      console.log('ℹ️  No new topics to add');
    }

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

addTopics();
