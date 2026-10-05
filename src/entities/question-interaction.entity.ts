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

/**
 * Tracks EVERY interaction a user has with a question
 * This allows us to analyze behavior patterns like:
 * - How many times they changed their answer
 * - Time spent on each option
 * - Hesitation patterns
 * - Answer-changing behavior under pressure
 */

export enum InteractionType {
  VIEW = 'view',
  SELECT = 'select',
  DESELECT = 'deselect',
  HOVER = 'hover',
  FLAG = 'flag',
  UNFLAG = 'unflag',
  SUBMIT = 'submit',
}
@Entity('question_interactions')
@Index(['userId', 'questionId', 'sessionId'])
@Index(['createdAt'])
export class QuestionInteraction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'int', nullable: true })
  testId: number; // If part of a test

  @Column({ type: 'int', nullable: true })
  contestId: number; // If part of a contest

  @Column({ type: 'varchar', length: 36 })
  sessionId: string; // Groups all interactions for one question attempt

  @Column({ type: 'int', nullable: true })
  selectedOptionId: number; // Which option they selected/hovered

  @Column({
    type: 'enum',
    enum: InteractionType,
  })
  actionType: InteractionType;

  @Column({ type: 'int' })
  timeFromStartMs: number; // Milliseconds from when they first saw the question

  @Column({ type: 'json', nullable: true })
  metadata: {
    previousOptionId?: string; // For tracking answer changes
    scrollPosition?: number;
    isReview?: boolean; // If they're reviewing after submission
    deviceType?: string; // mobile, tablet, desktop
  };

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
}
