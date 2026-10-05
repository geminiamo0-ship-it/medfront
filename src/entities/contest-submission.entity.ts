import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContestParticipant } from './contest-participant.entity';
import { Question } from './question.entity';
import { QuestionOption } from './question-option.entity';

/**
 * Individual question submission within a contest
 * Links to QuestionInteraction for detailed behavior
 */
@Entity('contest_submissions')
@Index(['participantId'])
@Index(['questionId'])
@Index(['submittedAt'])
export class ContestSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  participantId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'varchar', length: 36 })
  sessionId: string; // Links to QuestionInteraction records

  @Column({ type: 'int' })
  questionNumber: number; // Order in contest (1, 2, 3...)

  @Column({ type: 'int', nullable: true })
  selectedOptionId: number;

  @Column({ type: 'boolean' })
  isCorrect: boolean;

  @Column({ type: 'int' })
  pointsAwarded: number; // Based on contest scoring rules

  @Column({ type: 'int', nullable: true })
  speedBonus: number; // Extra points for fast correct answers

  @Column({ type: 'int' })
  timeSpentSeconds: number;

  // BEHAVIORAL DATA (from QuestionInteraction aggregation)
  @Column({ type: 'int', default: 0 })
  answerChanges: number;

  @Column({ type: 'json', nullable: true })
  answerSequence: string[]; // Order of options selected

  @Column({ type: 'boolean', default: false })
  wasMarked: boolean; // Flagged for review

  @Column({ type: 'boolean', default: false })
  wasReviewed: boolean; // Did they come back to review it

  @Column({ type: 'int', nullable: true })
  timeInReview: number; // Seconds spent in review

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => ContestParticipant)
  @JoinColumn({ name: 'participantId' })
  participant: ContestParticipant;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;

  @ManyToOne(() => QuestionOption, { nullable: true })
  @JoinColumn({ name: 'selectedOptionId' })
  selectedOption: QuestionOption;

  // Computed properties
  get performanceRating(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!this.isCorrect) return 'poor';
    if (this.answerChanges === 0 && this.timeSpentSeconds < 90) return 'excellent';
    if (this.answerChanges <= 1 && this.timeSpentSeconds < 150) return 'good';
    return 'fair';
  }

  get confidenceLevel(): 'high' | 'medium' | 'low' {
    if (this.answerChanges === 0 && this.timeSpentSeconds < 120) return 'high';
    if (this.answerChanges <= 1) return 'medium';
    return 'low';
  }
}
