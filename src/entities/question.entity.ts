import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { QuestionBank, USMLEStep } from './question-bank.entity';
import { Subject } from './subject.entity';
import { System } from './system.entity';
import { Topic } from './topic.entity';
import { resolveDifficultyFromCorrectOptionRate } from '../utils/question-difficulty.util';


export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

/**
 * 5-tier Create-Test difficulty, stored in questions.difficulty and
 * trigger-maintained from the correct option's uworld_chosen_by:
 *   VERY_HARD [0,30) · HARD [30,50) · MEDIUM [50,65) · EASY [65,75) ·
 *   VERY_EASY [75,100]. Threshold source of truth:
 *   recompute_question_difficulty() in migration 1803000000014.
 * Distinct from the legacy 3-tier QuestionDifficulty above, which analytics
 * still consumes.
 */
export enum QuestionDifficultyTier {
  VERY_HARD = 'very_hard',
  HARD = 'hard',
  MEDIUM = 'medium',
  EASY = 'easy',
  VERY_EASY = 'very_easy',
}

@Entity('questions')
@Index(['questionBankId'])
@Index(['subjectId', 'systemId'])
@Index('IDX_questions_step_is_active', ['step', 'isActive'])
@Index(['source'])
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  questionBankId: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  externalId: string; // e.g., uworld_id

  @Column({ type: 'text' })
  textHtml: string; // Question stem with rich HTML

  @Column({ type: 'text' })
  explanationHtml: string; // Detailed explanation with rich HTML

  @Column({ type: 'int' })
  subjectId: number;

  @Column({ type: 'int', nullable: true })
  systemId: number;

  @Column({ type: 'int', nullable: true })
  topicId: number;

  @Column({ type: 'int' })
  step: USMLEStep;

  @Column({ type: 'varchar', length: 50 })
  source: string; // e.g., "uworld", "nbme"

  @Column({ type: 'json', nullable: true })
  imageUrls: string[]; // Array of image URLs

  @Column({ type: 'varchar', length: 500, nullable: true })
  videoUrl: string;

  @Column({ type: 'int', nullable: true })
  articleId: number; // Links to a specific article in the library

  @Column({ type: 'varchar', length: 100, nullable: true })
  libraryName: string; // The library source for the article (e.g., "pastest")

  @Column({ type: 'int', default: 90 })
  estimatedTimeSeconds: number; // Average time to answer

  @Column({ type: 'int', default: 0 })
  timesAnswered: number; // Global statistics

  @Column({ type: 'int', default: 0 })
  timesCorrect: number; // Global statistics

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  parentSetId: number; // For questions that belong to a set (e.g. part 1 and part 2)

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => QuestionBank, (qb) => qb.questions)
  @JoinColumn({ name: 'questionBankId' })
  questionBank: QuestionBank;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @ManyToOne(() => System, { nullable: true })
  @JoinColumn({ name: 'systemId' })
  system: System;

  @ManyToOne(() => Topic, { nullable: true })
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  @OneToMany('QuestionOption', 'question', {
    cascade: true,
  })
  options: any[];

  /**
   * Stored 5-tier difficulty derived from the CORRECT option's
   * uworld_chosen_by and maintained automatically by the DB trigger
   * trg_question_options_difficulty (see migration 1803000000014) — never
   * write it from app code. NULL = no UWorld data. Property named
   * difficultyTier because the legacy 3-tier computed getter below already
   * owns the `difficulty` name. Column stays varchar (not a PG enum type)
   * so the trigger function and future threshold changes never need an
   * ALTER TYPE dance.
   */
  @Column({ type: 'varchar', length: 12, name: 'difficulty', nullable: true })
  difficultyTier: QuestionDifficultyTier | null;

  get difficulty(): QuestionDifficulty {
    const correctOption = this.options?.find((option: any) => option?.isCorrect);
    return resolveDifficultyFromCorrectOptionRate(correctOption?.uworldChosenBy) as QuestionDifficulty;
  }

  set difficulty(_value: QuestionDifficulty | string | null | undefined) {
    // Derived from the correct option's UWorld chosen rate. Setter is a no-op for legacy writes.
  }

  // Computed property
  get globalAccuracyRate(): number {
    if (this.timesAnswered === 0) return 0;
    return (this.timesCorrect / this.timesAnswered) * 100;
  }
}
