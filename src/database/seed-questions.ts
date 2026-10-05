import { DataSource } from 'typeorm';
import { Question, QuestionDifficulty } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { ALL_EXAM_STEPS, USMLEStep } from '../entities/question-bank.entity';

/**
 * Generate 100+ fake questions for testing
 */
export async function seedManyQuestions(
  dataSource: DataSource,
  subjectIds: number[],
  systemIds: number[],
  topicIds: number[],
  questionBankId: number
) {
  console.log('🔢 Generating 100+ fake questions...');
  
  const questionRepo = dataSource.getRepository(Question);
  const optionRepo = dataSource.getRepository(QuestionOption);

  const difficulties = [QuestionDifficulty.EASY, QuestionDifficulty.MEDIUM, QuestionDifficulty.HARD];
  const steps = ALL_EXAM_STEPS;
  
  const questionTemplates = [
    {
      text: 'A {age}-year-old {gender} presents with {symptom}. Physical examination reveals {finding}. What is the most likely diagnosis?',
      explanation: 'This presentation is classic for {diagnosis}. The key findings include {keyFindings}.',
    },
    {
      text: 'A patient with {condition} is started on {medication}. What is the mechanism of action?',
      explanation: 'The mechanism involves {mechanism}. This is important because {reason}.',
    },
    {
      text: 'Which of the following is the most appropriate next step in management for a patient with {condition}?',
      explanation: 'The correct answer is {answer} because {reasoning}.',
    },
    {
      text: 'A {age}-year-old patient undergoes {procedure}. Post-operatively, they develop {complication}. What is the underlying pathophysiology?',
      explanation: 'The pathophysiology involves {pathophys}. This occurs due to {cause}.',
    },
  ];

  const ages = ['2', '5', '12', '25', '45', '65', '78'];
  const genders = ['male', 'female'];
  const symptoms = ['fever and cough', 'chest pain', 'abdominal pain', 'headache', 'fatigue', 'shortness of breath'];
  const findings = ['tachycardia', 'hypotension', 'elevated temperature', 'decreased breath sounds', 'hepatomegaly'];
  const diagnoses = ['pneumonia', 'myocardial infarction', 'appendicitis', 'meningitis', 'heart failure', 'COPD exacerbation'];
  
  const createdQuestions: Question[] = [];

  for (let i = 1; i <= 120; i++) {
    const template = questionTemplates[i % questionTemplates.length];
    const difficulty = difficulties[i % 3];
    const step = steps[i % 3];
    const subjectId = subjectIds[i % subjectIds.length];
    const systemId = systemIds[i % systemIds.length];
    const topicId = topicIds[i % topicIds.length];

    // Generate question text
    let questionText = template.text
      .replace('{age}', ages[i % ages.length])
      .replace('{gender}', genders[i % 2])
      .replace('{symptom}', symptoms[i % symptoms.length])
      .replace('{finding}', findings[i % findings.length])
      .replace('{condition}', diagnoses[i % diagnoses.length])
      .replace('{medication}', 'medication-' + i)
      .replace('{procedure}', 'procedure-' + i)
      .replace('{complication}', 'complication-' + i);

    let explanationText = template.explanation
      .replace('{diagnosis}', diagnoses[i % diagnoses.length])
      .replace('{keyFindings}', findings[i % findings.length])
      .replace('{mechanism}', 'mechanism-' + i)
      .replace('{reason}', 'reason-' + i)
      .replace('{answer}', 'answer-' + i)
      .replace('{reasoning}', 'reasoning-' + i)
      .replace('{pathophys}', 'pathophysiology-' + i)
      .replace('{cause}', 'cause-' + i);

    const question = await questionRepo.save({
      questionBankId,
      externalId: `FAKE-${i.toString().padStart(5, '0')}`,
      textHtml: `<p>${questionText}</p>`,
      explanationHtml: `<p>${explanationText}</p>`,
      subjectId,
      systemId,
      topicId,
      difficulty,
      step,
      source: 'generated',
      imageUrls: [],
      videoUrl: null,
      estimatedTimeSeconds: 90 + (i % 60), // 90-150 seconds
      timesAnswered: Math.floor(Math.random() * 5000),
      timesCorrect: Math.floor(Math.random() * 3000),
      isActive: true,
    });

    createdQuestions.push(question);

    // Create 4-5 options for each question
    const numOptions = 4 + (i % 2); // 4 or 5 options
    const correctOptionIndex = i % numOptions;

    for (let j = 0; j < numOptions; j++) {
      await optionRepo.save({
        questionId: question.id,
        textHtml: `Option ${String.fromCharCode(65 + j)}: Answer choice ${j + 1} for question ${i}`,
        isCorrect: j === correctOptionIndex,
        displayOrder: String.fromCharCode(65 + j), // A, B, C, D, E
        explanationHtml: j === correctOptionIndex 
          ? `<p>Correct! This is the right answer because of reason ${j + 1}.</p>`
          : `<p>Incorrect. This is wrong because of reason ${j + 1}.</p>`,
      });
    }

    // Log progress every 20 questions
    if (i % 20 === 0) {
      console.log(`   Generated ${i} questions...`);
    }
  }

  console.log(`✅ Created ${createdQuestions.length} questions with options`);
  return createdQuestions;
}
