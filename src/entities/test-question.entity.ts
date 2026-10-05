import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Test } from './test.entity';
import { Question } from './question.entity';

/**
 * Junction table linking tests to questions
 * Maintains the order of questions in the test
 */
@Entity('test_questions')
@Index(['testId'])
@Index(['questionId'])
export class TestQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  testId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'int' })
  displayOrder: number; // Order in which questions appear (1, 2, 3...)

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Test, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'testId' })
  test: Test;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
