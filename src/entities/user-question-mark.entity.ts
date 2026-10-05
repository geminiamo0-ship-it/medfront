import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Question } from './question.entity';

/**
 * A user's "marked for review" flag on a question — stored as the existence
 * of a row rather than a boolean column. Lookups are PK probes on
 * (user_id, question_id). Unmarking deletes the row.
 *
 * Lives in its own table (not on question_submissions) so a user can mark a
 * question without creating a fake omitted-submission row that would corrupt
 * the omitted/unanswered counts.
 */
@Entity('user_question_marks')
@Index(['questionId'])
export class UserQuestionMark {
  @PrimaryColumn({ type: 'int', name: 'user_id' })
  userId: number;

  @PrimaryColumn({ type: 'int', name: 'question_id' })
  questionId: number;

  @CreateDateColumn({ type: 'timestamp', name: 'marked_at' })
  markedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: Question;
}
