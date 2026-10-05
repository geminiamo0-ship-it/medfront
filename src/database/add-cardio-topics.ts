import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Topic } from '../entities/topic.entity';
import { System } from '../entities/system.entity';
import { Subject } from '../entities/subject.entity';
import { Question, QuestionDifficulty } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { QuestionBank, USMLEStep } from '../entities/question-bank.entity';

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
  logging: false, // Disable logging for cleaner output
});

async function addCardioTopicsAndQuestions() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!\n');

    const topicRepo = AppDataSource.getRepository(Topic);
    const systemRepo = AppDataSource.getRepository(System);
    const subjectRepo = AppDataSource.getRepository(Subject);
    const questionRepo = AppDataSource.getRepository(Question);
    const optionRepo = AppDataSource.getRepository(QuestionOption);
    const qbankRepo = AppDataSource.getRepository(QuestionBank);

    // Get existing data
    const internalMedicine = await subjectRepo.findOne({ where: { code: 'IM' } });
    const cardioSystem = await systemRepo.findOne({ where: { code: 'CARDIO' } });
    const uworldBank = await qbankRepo.findOne({ where: { code: 'UWORLD' } });

    if (!internalMedicine || !cardioSystem || !uworldBank) {
      console.error('❌ Required data not found. Please run the main seed first.');
      process.exit(1);
    }

    console.log('📋 Creating 10 Cardiovascular topics...\n');

    const cardioTopicsData = [
      { name: 'Heart Failure', description: 'Systolic and diastolic heart failure, management strategies' },
      { name: 'Arrhythmias', description: 'Atrial fibrillation, ventricular tachycardia, bradyarrhythmias' },
      { name: 'Coronary Artery Disease', description: 'Atherosclerosis, acute coronary syndrome, MI' },
      { name: 'Valvular Heart Disease', description: 'Stenosis and regurgitation of cardiac valves' },
      { name: 'Hypertension', description: 'Primary and secondary hypertension, management' },
      { name: 'Cardiomyopathies', description: 'Dilated, hypertrophic, and restrictive cardiomyopathy' },
      { name: 'Pericardial Disease', description: 'Pericarditis, pericardial effusion, tamponade' },
      { name: 'Congenital Heart Disease', description: 'Atrial and ventricular septal defects, tetralogy of Fallot' },
      { name: 'Peripheral Vascular Disease', description: 'Arterial and venous insufficiency, DVT' },
      { name: 'Cardiac Pharmacology', description: 'Antihypertensives, antiarrhythmics, anticoagulants' },
    ];

    const createdTopics = [];

    for (let i = 0; i < cardioTopicsData.length; i++) {
      const topicData = cardioTopicsData[i];
      
      // Check if topic already exists
      let topic = await topicRepo.findOne({
        where: { name: topicData.name, systemId: cardioSystem.id }
      });

      if (!topic) {
        topic = await topicRepo.save({
          name: topicData.name,
          description: topicData.description,
          subjectId: internalMedicine.id,
          systemId: cardioSystem.id,
          displayOrder: i + 1,
          isActive: true,
        });
        console.log(`✅ Created topic: ${topic.name}`);
      } else {
        console.log(`ℹ️  Topic already exists: ${topic.name}`);
      }

      createdTopics.push(topic);
    }

    console.log(`\n📝 Generating 100 questions for each topic (1000 total)...\n`);

    const difficulties = [QuestionDifficulty.EASY, QuestionDifficulty.MEDIUM, QuestionDifficulty.HARD];
    
    let totalQuestionsCreated = 0;

    for (const topic of createdTopics) {
      console.log(`   Generating questions for: ${topic.name}...`);
      
      for (let i = 1; i <= 100; i++) {
        const difficulty = difficulties[i % 3];
        
        const question = await questionRepo.save({
          questionBankId: uworldBank.id,
          externalId: `CARDIO-${topic.id}-${i.toString().padStart(3, '0')}`,
          textHtml: `<p>A 55-year-old patient presents with symptoms related to ${topic.name}. Question ${i} for this topic. What is the most appropriate next step in management?</p>`,
          explanationHtml: `<p>This question tests knowledge of ${topic.name}. The correct answer involves understanding the pathophysiology and clinical presentation.</p>`,
          subjectId: internalMedicine.id,
          systemId: cardioSystem.id,
          topicId: topic.id,
          difficulty,
          step: USMLEStep.STEP_1,
          source: 'generated',
          imageUrls: [],
          videoUrl: null,
          estimatedTimeSeconds: 90,
          timesAnswered: Math.floor(Math.random() * 1000),
          timesCorrect: Math.floor(Math.random() * 600),
          isActive: true,
        });

        // Create 4 options for each question
        const correctIndex = i % 4;
        for (let j = 0; j < 4; j++) {
          await optionRepo.save({
            questionId: question.id,
            textHtml: `Option ${String.fromCharCode(65 + j)}: Treatment/diagnostic approach ${j + 1}`,
            isCorrect: j === correctIndex,
            displayOrder: String.fromCharCode(65 + j),
            explanationHtml: j === correctIndex 
              ? `<p>Correct! This is the appropriate approach for ${topic.name}.</p>`
              : `<p>Incorrect. This is not the best option in this clinical scenario.</p>`,
          });
        }

        totalQuestionsCreated++;
      }
      
      console.log(`      ✓ Created 100 questions for ${topic.name}`);
    }

    console.log(`\n Successfully created:`);
    console.log(`   📂 ${createdTopics.length} topics`);
    console.log(`   ❓ ${totalQuestionsCreated} questions`);
    console.log(`   📝 ${totalQuestionsCreated * 4} options\n`);

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

addCardioTopicsAndQuestions();
