import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Contest } from './contest.entity';
import { Question } from './question.entity';

@Entity('contest_questions')
@Index(['contestId', 'displayOrder'])
export class ContestQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  contestId: number;

  @Column({ type: 'int' })
  questionId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'int', default: 1 })
  points: number;

  @ManyToOne(() => Contest)
  @JoinColumn({ name: 'contestId' })
  contest: Contest;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
