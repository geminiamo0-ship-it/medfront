import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Question } from './question.entity';

@Entity('question_options')
@Index(['questionId'])
export class QuestionOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'text' })
  textHtml: string; // Option text with rich HTML

  @Column({ type: 'boolean' })
  isCorrect: boolean;

  @Column({ type: 'int', nullable: true, name: 'uworld_chosen_by' })
  uworldChosenBy: number;

  @Column({ type: 'char', length: 1 })
  displayOrder: string; // 'A', 'B', 'C', 'D', 'E', 'F'

  @Column({ type: 'text', nullable: true })
  explanationHtml: string; // Why this option is right/wrong

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Question, (question) => question.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
