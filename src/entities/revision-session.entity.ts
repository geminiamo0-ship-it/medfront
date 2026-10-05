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
import { QuestionBank } from './question-bank.entity';
import { Subject } from './subject.entity';
import { System } from './system.entity';

/**
 * A revision session over a user's marked questions, scoped to a
 * (qBank, subject, optional system) slice. Each session locks in a snapshot
 * of question IDs at start time so that future sessions on the same slice can
 * exclude already-snapshotted IDs — the user never sees the same question
 * twice across separate revision sessions, even if they mark/unmark other
 * questions in between.
 *
 * Not a Test: revision sessions are pure read-only viewers, never feed
 * analytics, and do not appear in Previous tests.
 */
@Entity('revision_sessions')
@Index(['userId', 'qBankId', 'subjectId', 'systemId', 'completedAt'])
export class RevisionSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @Column({ type: 'int', name: 'q_bank_id' })
  qBankId: number;

  @Column({ type: 'int', name: 'subject_id' })
  subjectId: number;

  @Column({ type: 'int', name: 'system_id', nullable: true })
  systemId: number | null;

  @Column({ type: 'int', array: true, name: 'question_ids', default: () => "'{}'" })
  questionIds: number[];

  @CreateDateColumn({ type: 'timestamptz', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', name: 'last_viewed_index', default: 0 })
  lastViewedIndex: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => QuestionBank, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'q_bank_id' })
  questionBank: QuestionBank;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => System, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'system_id' })
  system: System | null;
}
