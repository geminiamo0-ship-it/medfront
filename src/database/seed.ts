import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Subject } from '../entities/subject.entity';
import { System } from '../entities/system.entity';
import { Topic } from '../entities/topic.entity';
import {
  USMLEStep,
  QuestionBank,
} from '../entities/question-bank.entity';
import { Question, QuestionDifficulty } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { UserRole, SubscriptionPlan, User } from '../entities/user.entity';
import { UserPreferences, Theme } from '../entities/user-preferences.entity';
import { Contest, ContestStatus, ContestType } from '../entities/contest.entity';
import { seedManyQuestions } from './seed-questions';
import { seedRealisticProfiles } from './seed-realistic-profiles';
import { Test, TestType, TestMode, TestStatus } from '../entities/test.entity';
import { QuestionSubmission } from '../entities/question-submission.entity';

export async function seedDatabase(dataSource: DataSource) {
  console.log('🌱 Starting database seeding...');

  // ========================================
  // 1. SUBJECTS
  // ========================================
  console.log('📚 Seeding Subjects...');
  const subjectRepo = dataSource.getRepository(Subject);
  
  const subjects = await subjectRepo.save([
    {
      name: 'Pediatrics',
      code: 'PED',
      description: 'Medical care of infants, children, and adolescents',
      icon: '👶',
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Internal Medicine',
      code: 'IM',
      description: 'Prevention, diagnosis, and treatment of adult diseases',
      icon: '🏥',
      displayOrder: 2,
      isActive: true,
    },
    {
      name: 'Surgery',
      code: 'SURG',
      description: 'Operative treatment of diseases and injuries',
      icon: '🔪',
      displayOrder: 3,
      isActive: true,
    },
    {
      name: 'Obstetrics & Gynecology',
      code: 'OBGYN',
      description: 'Women\'s health and reproductive medicine',
      icon: '🤰',
      displayOrder: 4,
      isActive: true,
    },
    {
      name: 'Psychiatry',
      code: 'PSY',
      description: 'Mental health and behavioral disorders',
      icon: '🧠',
      displayOrder: 5,
      isActive: true,
    },
    {
      name: 'Neurology',
      code: 'NEURO',
      description: 'Disorders of the nervous system',
      icon: '⚡',
      displayOrder: 6,
      isActive: true,
    },
  ]);
  console.log(`✅ Created ${subjects.length} subjects`);

  // ========================================
  // 2. SYSTEMS
  // ========================================
  console.log('🫀 Seeding Systems...');
  const systemRepo = dataSource.getRepository(System);
  
  const systems = await systemRepo.save([
    {
      name: 'Cardiovascular',
      code: 'CARDIO',
      description: 'Heart and blood vessels',
      icon: '❤️',
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Respiratory',
      code: 'RESP',
      description: 'Lungs and airways',
      icon: '🫁',
      displayOrder: 2,
      isActive: true,
    },
    {
      name: 'Gastrointestinal',
      code: 'GI',
      description: 'Digestive system',
      icon: '🍽️',
      displayOrder: 3,
      isActive: true,
    },
    {
      name: 'Renal & Urinary',
      code: 'RENAL',
      description: 'Kidneys and urinary tract',
      icon: '💧',
      displayOrder: 4,
      isActive: true,
    },
    {
      name: 'Musculoskeletal',
      code: 'MSK',
      description: 'Bones, muscles, and joints',
      icon: '🦴',
      displayOrder: 5,
      isActive: true,
    },
    {
      name: 'Endocrine',
      code: 'ENDO',
      description: 'Hormones and metabolism',
      icon: '⚗️',
      displayOrder: 6,
      isActive: true,
    },
    {
      name: 'Hematology & Oncology',
      code: 'HEMONC',
      description: 'Blood disorders and cancer',
      icon: '🩸',
      displayOrder: 7,
      isActive: true,
    },
    {
      name: 'Allergy & Immunology',
      code: 'IMMUNO',
      description: 'Immune system and allergies',
      icon: '🛡️',
      displayOrder: 8,
      isActive: true,
    },
    {
      name: 'Infectious Disease',
      code: 'ID',
      description: 'Bacterial, viral, and parasitic infections',
      icon: '🦠',
      displayOrder: 9,
      isActive: true,
    },
  ]);
  console.log(`✅ Created ${systems.length} systems`);

  // ========================================
  // ========================================
  // 3. TOPICS
  // ========================================
  console.log('📖 Seeding Topics...');
  const topicRepo = dataSource.getRepository(Topic);
  
  const internalMedicine = subjects.find(s => s.code === 'IM');
  const pediatrics = subjects.find(s => s.code === 'PED');
  const renalSystem = systems.find(s => s.code === 'RENAL');
  const cardioSystem = systems.find(s => s.code === 'CARDIO');
  const giSystem = systems.find(s => s.code === 'GI');
  const respiratorySystem = systems.find(s => s.code === 'RESP');
  const immunoSystem = systems.find(s => s.code === 'IMMUNO');
  
  const topicsData = [
    // Renal
    { name: 'Glomerular diseases', systemId: renalSystem.id, subjectId: internalMedicine.id },
    { name: 'Cystic kidney diseases', systemId: renalSystem.id, subjectId: internalMedicine.id },
    { name: 'Neoplasms of kidney', systemId: renalSystem.id, subjectId: internalMedicine.id },
    { name: 'Chronic kidney disease', systemId: renalSystem.id, subjectId: internalMedicine.id },
    { name: 'Acute kidney injury', systemId: renalSystem.id, subjectId: internalMedicine.id },
    
    // Cardio
    { name: 'Heart Failure', systemId: cardioSystem.id, subjectId: internalMedicine.id },
    { name: 'Arrhythmias', systemId: cardioSystem.id, subjectId: internalMedicine.id },
    { name: 'Valvular disease', systemId: cardioSystem.id, subjectId: internalMedicine.id },
    { name: 'Congenital heart disease', systemId: cardioSystem.id, subjectId: pediatrics.id },
    
    // GI
    { name: 'Esophageal disorders', systemId: giSystem.id, subjectId: internalMedicine.id },
    { name: 'Peptic ulcer disease', systemId: giSystem.id, subjectId: internalMedicine.id },
    { name: 'Inflammatory bowel disease', systemId: giSystem.id, subjectId: internalMedicine.id },
    
    // Respiratory
    { name: 'Asthma', systemId: respiratorySystem.id, subjectId: internalMedicine.id },
    { name: 'COPD', systemId: respiratorySystem.id, subjectId: internalMedicine.id },
    { name: 'Pneumonia', systemId: respiratorySystem.id, subjectId: internalMedicine.id },
    
    // Immuno
    { name: 'Immune deficiencies', systemId: immunoSystem.id, subjectId: pediatrics.id },
    { name: 'Autoimmunity', systemId: immunoSystem.id, subjectId: internalMedicine.id },
    
    // No system (General)
    { name: 'Developmental milestones', systemId: null, subjectId: pediatrics.id },
    { name: 'Ethics & Legal', systemId: null, subjectId: internalMedicine.id },
  ];

  const topics = await topicRepo.save(topicsData.map((t, i) => ({
    ...t,
    description: `Detailed study of ${t.name}`,
    displayOrder: i + 1,
    isActive: true,
  })));
  console.log(`✅ Created ${topics.length} topics`);

  // ========================================
  // 4. QUESTION BANKS
  // ========================================
  console.log('📦 Seeding Question Banks...');
  const qbankRepo = dataSource.getRepository(QuestionBank);
  
  const questionBanks = await qbankRepo.save([
    {
      name: 'UWorld',
      code: 'UWORLD',
      description: 'Comprehensive USMLE question bank with detailed explanations',
      step: USMLEStep.STEP_1,
      totalQuestions: 3645,
      isPremium: true,
      icon: '🌍',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      isActive: true,
    },
    {
      name: 'NBME',
      code: 'NBME',
      description: 'Official practice exams from the National Board',
      step: USMLEStep.STEP_1,
      totalQuestions: 800,
      isPremium: true,
      icon: '📋',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      isActive: true,
    },
    {
      name: 'Amboss',
      code: 'AMBOSS',
      description: 'High-yield questions with learning cards',
      step: USMLEStep.STEP_1,
      totalQuestions: 2500,
      isPremium: true,
      icon: '📚',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      isActive: true,
    },
  ]);
  console.log(`✅ Created ${questionBanks.length} question banks`);

  // ========================================
  // 5. QUESTIONS (From your SQL examples)
  // ========================================
  console.log('❓ Seeding Questions...');
  const questionRepo = dataSource.getRepository(Question);
  const optionRepo = dataSource.getRepository(QuestionOption);
  
  const uworldBank = questionBanks.find(qb => qb.code === 'UWORLD');
  const immunoDefTopic = topics.find(t => t.name === 'Immune deficiencies');
  
  // Question 1: Chronic Granulomatous Disease
  const question1 = await questionRepo.save({
    questionBankId: uworldBank.id,
    externalId: '12518',
    textHtml: '<p>A 2-year-old boy is brought to the office due to fever, cough, and irritability lasting 3 days.  Medical history is significant for a perirectal abscess that was drained at age 9 months.  Temperature is 38.9 C (102 F), blood pressure is 100/70 mm Hg, pulse is 124/min, and respirations are 24/min.  Eyes, ears, nose, and throat examinations are normal.  Bilateral patchy crackles are auscultated in the lower lobes.  Chest x-ray confirms bilateral focal pneumonia.  The patient receives empiric antibiotic therapy; however, he is persistently febrile after 3 days.  CT scan of the chest reveals a small, left pleural effusion and enlarged paratracheal and hilar lymphadenopathy, in addition to the bilateral pneumonia.  Fine-needle biopsy of the lymph nodes and lung tissue shows an inflammatory reaction with granuloma formation.  Biopsy cultures grow <em>Burkholderia</em> (<em>Pseudomonas</em>) <em>cepacia</em>.  What is the mechanism most likely responsible for this patient\'s current infection?</p>',
    explanationHtml: '<div id="div_t31667"><table class="table-default-style table-footer-only-style"><tbody><tr><td colspan="2"><p align="center"><strong>Chronic granulomatous disease</strong></p></td></tr><tr><td><p align="center"><strong>Pathogenesis</strong></p></td><td><ul><li>X-linked recessive mutation of NADPH oxidase</li><li>Impaired respiratory burst &amp; ↓ reactive oxygen species → inhibition of phagocytic intracellular killing</li></ul></td></tr><tr><td><p align="center"><strong>Clinical features</strong></p></td><td><ul><li>Recurrent infections with catalase-positive* bacteria &amp; fungi</li><li>Lungs, skin, liver, lymph node involvement</li><li>Diffuse granulomas (eg, gastrointestinal, genitourinary)</li></ul></td></tr></tbody></table></div><p>This patient with <em>Burkholderia</em> pneumonia and granulomas most likely has <strong>chronic granulomatous disease</strong> (CGD).</p>',
    subjectId: pediatrics.id,
    systemId: immunoSystem.id,
    topicId: immunoDefTopic.id,
    difficulty: QuestionDifficulty.HARD,
    step: USMLEStep.STEP_1,
    source: 'uworld',
    imageUrls: [],
    videoUrl: null,
    estimatedTimeSeconds: 150,
    timesAnswered: 1543,
    timesCorrect: 892,
    isActive: true,
  });

  await optionRepo.save([
    {
      questionId: question1.id,
      textHtml: 'Decreased immunoglobulin production',
      isCorrect: false,
      displayOrder: 'A',
      explanationHtml: 'Decreased immunoglobulin production, as seen in X-linked agammaglobulinemia, generally presents with recurrent sinopulmonary infections with encapsulated bacteria.',
    },
    {
      questionId: question1.id,
      textHtml: 'Decreased superoxide anion formation',
      isCorrect: true,
      displayOrder: 'B',
      explanationHtml: 'Correct! CGD involves mutations in NADPH oxidase, resulting in decreased formation of superoxide anions and inability of phagocytes to kill catalase-positive organisms.',
    },
    {
      questionId: question1.id,
      textHtml: 'Defective complement activation',
      isCorrect: false,
      displayOrder: 'C',
      explanationHtml: 'Complement dysfunction (eg, C3 deficiency) causes defective opsonization and infection due to encapsulated bacteria.',
    },
    {
      questionId: question1.id,
      textHtml: 'Impaired airway clearance',
      isCorrect: false,
      displayOrder: 'D',
      explanationHtml: 'Impaired airway clearance is a feature of cystic fibrosis, which can predispose to B. cepacia pneumonia, but granuloma formation does not occur.',
    },
    {
      questionId: question1.id,
      textHtml: 'Impaired neutrophil chemotaxis',
      isCorrect: false,
      displayOrder: 'E',
      explanationHtml: 'Impaired neutrophil chemotaxis is seen in leukocyte adhesion deficiency. Patients are susceptible to recurrent skin and mucosal infections.',
    },
  ]);

  // Question 2: SCID
  const question2 = await questionRepo.save({
    questionBankId: uworldBank.id,
    externalId: '4762',
    textHtml: '<p>A 1-year-old boy is admitted to the intensive care unit for severe respiratory distress and hypoxia requiring endotracheal intubation and mechanical ventilation.  Medical history shows 2 prior episodes of pneumonia, chronic thrush, and tympanostomy tube placement for recurrent otitis media.  His vaccinations are not fully up to date due to illness at the time of his well visits.  The patient is at the 2nd percentile for height and weight.  Physical examination shows diffuse crackles in both lungs.  Laboratory results show lymphopenia with absent CD3+ cells and low CD19+ cells. Which of the following is the best long-term treatment for this patient?</p>',
    explanationHtml: '<div><table><tbody><tr><td colspan="2"><p align="center"><strong>Severe combined immunodeficiency</strong></p></td></tr><tr><td><p align="center"><strong>Etiology</strong></p></td><td><ul><li>Gene defect leading to failure of T-cell development</li><li>B-cell dysfunction due to absent T cells</li></ul></td></tr><tr><td><p align="center"><strong>Treatment</strong></p></td><td><ul><li>Stem cell transplant</li></ul></td></tr></tbody></table></div><p><strong>Stem cell transplantation</strong> is the only definitive therapy and should be performed as early as possible.</p>',
    subjectId: pediatrics.id,
    systemId: immunoSystem.id,
    topicId: immunoDefTopic.id,
    difficulty: QuestionDifficulty.MEDIUM,
    step: USMLEStep.STEP_1,
    source: 'uworld',
    imageUrls: [],
    videoUrl: null,
    estimatedTimeSeconds: 120,
    timesAnswered: 2103,
    timesCorrect: 1682,
    isActive: true,
  });

  await optionRepo.save([
    {
      questionId: question2.id,
      textHtml: 'Antiretroviral therapy',
      isCorrect: false,
      displayOrder: 'A',
      explanationHtml: 'Antiretroviral therapy is used for HIV infection, not SCID.',
    },
    {
      questionId: question2.id,
      textHtml: 'Intravenous immunoglobulin',
      isCorrect: false,
      displayOrder: 'B',
      explanationHtml: 'IVIG is short-term management while awaiting transplantation.',
    },
    {
      questionId: question2.id,
      textHtml: 'Live attenuated vaccines',
      isCorrect: false,
      displayOrder: 'C',
      explanationHtml: 'Live vaccines are contraindicated in SCID as they can cause severe disease.',
    },
    {
      questionId: question2.id,
      textHtml: 'Stem cell transplantation',
      isCorrect: true,
      displayOrder: 'D',
      explanationHtml: 'Correct! Stem cell transplantation is the only definitive therapy for SCID.',
    },
    {
      questionId: question2.id,
      textHtml: 'Broad-spectrum antibiotics',
      isCorrect: false,
      displayOrder: 'E',
      explanationHtml: 'Antibiotics are supportive care but not long-term treatment.',
    },
  ]);

  console.log(`✅ Created 2 sample questions with options`);

  // Generate 120 additional fake questions for testing
  const additionalQuestions = await seedManyQuestions(
    dataSource,
    subjects.map(s => s.id),
    systems.map(s => s.id),
    topics.map(t => t.id),
    uworldBank.id
  );

  const allQuestions = [question1, question2, ...additionalQuestions];

  // ========================================
  // 6. USERS
  // ========================================
  console.log('👥 Seeding Users...');
  const userRepo = dataSource.getRepository(User);
  const prefsRepo = dataSource.getRepository(UserPreferences);
  
  const password = 'password123';
  
  const users = await userRepo.save([
    {
      email: 'admin@medpark.com',
      password: password,
      name: 'Admin User',
      country: 'US',
      role: UserRole.SUPER_ADMIN,
      subscriptionPlan: SubscriptionPlan.PREMIUM,
      subscriptionExpiry: new Date('2027-12-31'),
      isActive: true,
    },
    {
      email: 'student@medpark.com',
      password: password,
      name: 'John Doe',
      country: 'US',
      role: UserRole.USER,
      subscriptionPlan: SubscriptionPlan.BASIC,
      subscriptionExpiry: new Date('2026-06-30'),
      isActive: true,
    },
    {
      email: 'premium@medpark.com',
      password: password,
      name: 'Jane Smith',
      country: 'CA',
      role: UserRole.USER,
      subscriptionPlan: SubscriptionPlan.PREMIUM,
      subscriptionExpiry: new Date('2026-12-31'),
      isActive: true,
    },
  ]);

  // Create preferences for each user
  for (const user of users) {
    await prefsRepo.save({
      userId: Number(user.id),
      theme: Theme.DARK,
      emailNotifications: true,
      contestReminders: true,
      defaultStep: 1,
    });
  }

  console.log(`✅ Created ${users.length} users with preferences`);

  // ========================================
  // 7. CONTESTS
  // ========================================
  console.log('🏆 Seeding Contests...');
  const contestRepo = dataSource.getRepository(Contest);
  
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const contests = await contestRepo.save([
    {
      title: 'Weekly Pediatrics Challenge',
      description: 'Test your knowledge of pediatric medicine with 20 challenging questions!',
      step: USMLEStep.STEP_1,
      type: ContestType.BALANCED,
      totalQuestions: 20,
      durationMinutes: 40,
      registrationOpenTime: now,
      registrationDeadline: tomorrow,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 40 * 60 * 1000),
      status: ContestStatus.REGISTRATION_OPEN,
      maxParticipants: 100,
      currentParticipants: 0,
      isPremium: false,
      prizeDescription: 'Top 3 winners get 1 month Premium subscription!',
      bannerUrl: null,
      rules: {
        allowCalculator: true,
        allowNotes: false,
        penaltyForWrongAnswer: 0,
        bonusForSpeed: true,
        showLeaderboardDuringContest: false,
      },
      scoring: {
        correctAnswerPoints: 5,
        wrongAnswerPenalty: 0,
        speedBonusMultiplier: 1.2,
        noAnswerPenalty: 0,
      },
      isActive: true,
    },
    {
      title: 'Speed Round: Immunology',
      description: 'Fast-paced immunology questions. Speed matters!',
      step: USMLEStep.STEP_1,
      type: ContestType.SPEED,
      totalQuestions: 15,
      durationMinutes: 20,
      registrationOpenTime: tomorrow,
      registrationDeadline: nextWeek,
      startTime: nextWeek,
      endTime: new Date(nextWeek.getTime() + 20 * 60 * 1000),
      status: ContestStatus.DRAFT,
      maxParticipants: null,
      currentParticipants: 0,
      isPremium: true,
      prizeDescription: 'Fastest correct answers win!',
      bannerUrl: null,
      rules: {
        allowCalculator: false,
        allowNotes: false,
        penaltyForWrongAnswer: 2,
        bonusForSpeed: true,
        showLeaderboardDuringContest: true,
      },
      scoring: {
        correctAnswerPoints: 10,
        wrongAnswerPenalty: 2,
        speedBonusMultiplier: 2.0,
        noAnswerPenalty: 0,
      },
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${contests.length} contests`);

  // ========================================
  // 8. PRACTICE TESTS & PERFORMANCE
  // ========================================
  console.log('📝 Seeding Practice Tests...');
  const testRepo = dataSource.getRepository(Test);
  const submissionRepo = dataSource.getRepository(QuestionSubmission);
  
  const student = users.find(u => u.email === 'student@medpark.com');
  if (student) {
    const test = await testRepo.save({
      userId: Number(student.id),
      title: 'Initial Diagnostic Test',
      type: TestType.TUTOR,
      mode: TestMode.ALL,
      step: USMLEStep.STEP_1,
      status: TestStatus.COMPLETED,
      totalQuestions: 10,
      answeredQuestions: 10,
      correctAnswers: 7,
      percentageScore: 70.00,
      timeSpentSeconds: 1200,
      startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 1200 * 1000),
      filters: {
        subjectIds: [Number(subjects[0].id)],
      }
    });

    // Create some submissions for this test
    const testQuestions = allQuestions.slice(0, 10);
    const submissions = [];
    
    for (let i = 0; i < testQuestions.length; i++) {
      const isCorrect = i < 7; // 70% accuracy
      submissions.push(submissionRepo.create({
        userId: Number(student.id),
        questionId: Number(testQuestions[i].id),
        testId: Number(test.id),
        sessionId: `seed-session-${test.id}-${i}`,
        isCorrect,
        timeSpentSeconds: 120,
        submittedAt: new Date(test.startedAt.getTime() + i * 120 * 1000),
        answerChanges: i % 3,
        wasGuessed: false,
      }));
    }
    await submissionRepo.save(submissions);
    console.log(`✅ Created ${submissions.length} submissions for student diagnostic test`);
  }

  // ========================================
  // 8. REALISTIC PROFILES & HISTORY
  // ========================================
  await seedRealisticProfiles(dataSource);

  // ========================================
  // SUMMARY
  // ========================================
  const finalUsers = await dataSource.getRepository(User).count();
  const finalQuestions = await dataSource.getRepository(Question).count();
  const finalContests = await dataSource.getRepository(Contest).count();
  
  console.log('\n🎉 Database seeding completed successfully!');
  console.log('═══════════════════════════════════════════');
  console.log(`📚 Subjects: ${subjects.length}`);
  console.log(`🫀 Systems: ${systems.length}`);
  console.log(`📖 Topics: ${topics.length}`);
  console.log(`📦 Question Banks: ${questionBanks.length}`);
  console.log(`❓ Questions: ${finalQuestions}`);
  console.log(`👥 Users: ${finalUsers}`);
  console.log(`🏆 Contests: ${finalContests}`);
  console.log('═══════════════════════════════════════════');
  console.log('\n💡 Test Credentials:');
  console.log('   Admin: admin@medpark.com / password123');
  console.log('   Student: student@medpark.com / password123');
  console.log('   Premium: premium@medpark.com / password123');
  console.log('\n✨ Ready to start building! ✨\n');
}
