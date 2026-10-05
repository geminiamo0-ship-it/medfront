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
import { QuestionBank } from './question-bank.entity';

@Entity('question_groupings')
@Index(['externalId', 'questionBankId'], { unique: true })
@Index(['questionBankId', 'groupKey'])
export class QuestionGrouping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  externalId: string; // e.g. UWorld ID

  @Column({ type: 'int' })
  questionBankId: number;

  @Column({ type: 'varchar', length: 50 })
  groupKey: string; // canonical group identifier (min externalId in group)

  @Column({ type: 'int' })
  position: number; // 1..N, preserves JSON array order

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => QuestionBank, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionBankId' })
  questionBank: QuestionBank;
}

