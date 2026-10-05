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

export enum FeedbackType {
  ERROR = 'error',
  CLARITY = 'clarity',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

@Entity('question_feedback')
@Index(['questionId'])
@Index(['userId'])
export class QuestionFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({
    type: 'enum',
    enum: FeedbackType,
    default: FeedbackType.OTHER,
  })
  type: FeedbackType;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
