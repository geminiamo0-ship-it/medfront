import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Question } from './question.entity';
import { QuestionOption } from './question-option.entity';

export enum AnswerTransitionPattern {
  C_TO_C = 'c_to_c',
  C_TO_I = 'c_to_i',
  I_TO_C = 'i_to_c',
  I_TO_I = 'i_to_i',
  UNKNOWN = 'unknown',
}

/**
 * Final submission record for a question
 * Includes behavioral analytics summary
 */
@Entity('question_submissions')
@Index(['userId', 'questionId', 'testId', 'contestId'], { unique: true })
@Index(['userId', 'questionId', 'testId'], { unique: true, where: '"contestId" IS NULL' })
@Index(['userId', 'questionId', 'contestId'], { unique: true, where: '"testId" IS NULL' })
@Index(['testId'])
@Index(['contestId'])
@Index(['userId', 'isMarked'])
@Index(['submittedAt'])
@Index(['testId', 'answerTransitionPattern'])
export class QuestionSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'int', nullable: true })
  testId: number;

  @Column({ type: 'int', nullable: true })
  contestId: number;

  @Column({ type: 'varchar', length: 36 })
  sessionId: string; // Links to QuestionInteraction records

  @Column({ type: 'int', nullable: true })
  selectedOptionId: number; // Final answer

  @Column({ type: 'int', nullable: true })
  firstSelectedOptionId: number; // First answer before any changes

  @Column({ type: 'boolean' })
  isCorrect: boolean;

  @Column({ type: 'boolean', default: false })
  isMarked: boolean; // Flagged for review

  @Column({ type: 'int' })
  timeSpentSeconds: number; // Total time on question

  // BEHAVIORAL ANALYTICS
  @Column({ type: 'int', default: 0 })
  answerChanges: number; // How many times they changed their answer

  @Column({ type: 'int', default: 0 })
  rightToWrongChanges: number; // Correct -> Incorrect

  @Column({ type: 'json', nullable: true })
  answerSequence: number[]; // Array of option IDs in order selected
  // Example: [2, 3, 4, 2]

  @Column({ type: 'jsonb', nullable: true })
  selectionHistory: {
    optionId: number;
    timestampMs: number;
  }[];

  @Column({
    type: 'enum',
    enum: AnswerTransitionPattern,
    default: AnswerTransitionPattern.UNKNOWN,
  })
  answerTransitionPattern: AnswerTransitionPattern;

  @Column({ type: 'int', nullable: true })
  timeToFirstAnswer: number; // Seconds until first selection

  @Column({ type: 'int', nullable: true })
  timeInReview: number; // Seconds spent reviewing after initial answer

  @Column({ type: 'boolean', default: false })
  wasGuessed: boolean; // If they spent < 10 seconds (configurable)

  @Column({ type: 'json', nullable: true })
  behaviorFlags: {
    quickAnswer?: boolean; // Answered in < 30 seconds
    slowAnswer?: boolean; // Answered in > 5 minutes
    multipleChanges?: boolean; // Changed answer 3+ times
    lastMinuteChange?: boolean; // Changed in final 10 seconds
    hesitant?: boolean; // Spent time hovering without selecting
  };

  @Column({ type: 'json', nullable: true })
  highlights: {
    text: string;
    startIndex: number;
    endIndex: number;
    color: string;
  }[];

  @Column({ type: 'text', nullable: true })
  notes: string; // Personal notes for this question submission

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;

  @ManyToOne(() => QuestionOption, { nullable: true })
  @JoinColumn({ name: 'selectedOptionId' })
  selectedOption: QuestionOption;

  // Computed properties for analytics
  get confidenceScore(): number {
    // Lower changes = higher confidence
    // Faster answer (but not too fast) = higher confidence
    let score = 100;
    
    score -= this.answerChanges * 15; // -15 per change
    if (this.wasGuessed) score -= 30;
    if (this.behaviorFlags?.multipleChanges) score -= 20;
    if (this.behaviorFlags?.lastMinuteChange) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  get performanceCategory(): 'strong' | 'moderate' | 'weak' | 'guessed' {
    if (this.wasGuessed) return 'guessed';
    if (this.isCorrect && this.answerChanges === 0 && this.timeSpentSeconds < 120) return 'strong';
    if (this.isCorrect && this.answerChanges <= 1) return 'moderate';
    return 'weak';
  }
}
