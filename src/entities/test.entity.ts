import { LibrarySource } from '../library/library-source.constants';
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
import { User } from './user.entity';
import { USMLEStep, ViewerThemeProfile } from './question-bank.entity';

export enum TestType {
  TUTOR = 'tutor', // See answers immediately
  TIMED = 'timed', // Timed exam simulation
  MIXED = 'mixed', // Timed + tutor-style answer reveal on submit
  CUSTOM = 'custom', // Custom settings
}

export enum TestMode {
  UNUSED = 'unused', // Only questions never answered
  INCORRECT = 'incorrect', // Only previously incorrect
  CORRECT = 'correct', // Only previously correct
  USED = 'used', // Any answered questions
  MARKED = 'marked', // Only marked questions
  MARKED_CORRECT = 'marked_correct', // Marked AND latest answered attempt correct
  MARKED_INCORRECT = 'marked_incorrect', // Marked AND latest answered attempt incorrect
  OMITTED = 'omitted', // Questions left unanswered when a test was completed
  SUSPENDED = 'suspended', // Questions assigned in suspended tests but never touched/submitted
  ALL = 'all', // All questions
  MIXED = 'mixed_modes', // Multiple modes combined — actual modes stored in filters.modes[]
}

export enum TestStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Entity('tests')
@Index(['userId', 'status'])
@Index(['completedAt'])
@Index(['step', 'status', 'completedAt'])
@Index(['blueprintSignature'])
@Index(['userId', 'isBlock', 'blockBankId', 'blockNumber'])
@Index(['blockBankId'])
export class Test {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: 'enum',
    enum: TestType,
    default: TestType.TUTOR,
  })
  type: TestType;

  @Column({
    type: 'enum',
    enum: TestMode,
    default: TestMode.ALL,
  })
  mode: TestMode;

  @Column({ type: 'int' })
  step: USMLEStep;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.IN_PROGRESS,
  })
  status: TestStatus;

  // Filters used to create test
  @Column({ type: 'json', nullable: true })
  filters: {
    subjectIds?: number[];
    systemIds?: number[];
    topicIds?: number[];
    questionBankIds?: number[];
    difficulty?: string[];
    modes?: string[]; // Populated when mode = MIXED; contains the actual selected TestMode values
  };

  @Column({ type: 'int' })
  totalQuestions: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  blueprintSignature: string;

  @Column({ type: 'int', default: 0 })
  answeredQuestions: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  omittedQuestions: number;

  @Column({ type: 'int', default: 0 })
  rightToWrongChanges: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentageScore: number;

  @Column({ type: 'int', default: 0 })
  timeSpentSeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  analyticsProcessedAt: Date;

  @Column({ type: 'int', nullable: true })
  timeLimitSeconds: number;

  // 1 = wall-clock semantics (legacy + Timed). 2 = active-time semantics (Mixed).
  // Branch on this column, NOT on `!!timeLimitSeconds`, so in-flight v=1 tests
  // keep wall-clock and only newly-created Mixed tests use active-time.
  @Column({ type: 'smallint', name: 'time_accounting_version', default: 1 })
  timeAccountingVersion: number;

  @Column({ type: 'boolean', default: false })
  isBlock: boolean;

  @Column({ type: 'int', nullable: true })
  blockNumber: number | null;

  @Column({ type: 'int', nullable: true })
  blockBankId: number | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: ViewerThemeProfile.STANDARD_EXAM,
  })
  viewerThemeProfileSnapshot: ViewerThemeProfile;

  @Column({
    type: 'varchar',
    length: 50,
    default: LibrarySource.ALL,
  })
  librarySourceSnapshot: LibrarySource;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Computed properties
  get isComplete(): boolean {
    return this.status === TestStatus.COMPLETED;
  }

  get progress(): number {
    if (this.totalQuestions === 0) return 0;
    return (this.answeredQuestions / this.totalQuestions) * 100;
  }
}
