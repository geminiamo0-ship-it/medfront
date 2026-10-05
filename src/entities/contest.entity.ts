import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { USMLEStep } from './question-bank.entity';

export enum ContestStatus {
  DRAFT = 'draft',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ContestType {
  SPEED = 'speed', // Fastest correct answers win
  ACCURACY = 'accuracy', // Most correct answers win
  BALANCED = 'balanced', // Combination of speed and accuracy
}

@Entity('contests')
@Index(['status', 'startTime'])
@Index(['step'])
export class Contest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  step: USMLEStep;

  @Column({
    type: 'enum',
    enum: ContestType,
    default: ContestType.BALANCED,
  })
  type: ContestType;

  @Column({ type: 'int' })
  totalQuestions: number;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ type: 'timestamp' })
  registrationOpenTime: Date;

  @Column({ type: 'timestamp' })
  registrationDeadline: Date;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: ContestStatus,
    default: ContestStatus.DRAFT,
  })
  status: ContestStatus;

  @Column({ type: 'int', nullable: true })
  maxParticipants: number;

  @Column({ type: 'int', default: 0 })
  currentParticipants: number;

  @Column({ type: 'boolean', default: false })
  isPremium: boolean;

  @Column({ type: 'text', nullable: true })
  prizeDescription: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string;

  @Column({ type: 'json', nullable: true })
  rules: {
    allowCalculator?: boolean;
    allowNotes?: boolean;
    penaltyForWrongAnswer?: number; // Points deducted
    bonusForSpeed?: boolean;
    showLeaderboardDuringContest?: boolean;
  };

  @Column({ type: 'json', nullable: true })
  scoring: {
    correctAnswerPoints: number;
    wrongAnswerPenalty: number;
    speedBonusMultiplier: number; // Faster = more points
    noAnswerPenalty: number;
  };

  @Column({ type: 'boolean', default: false })
  resultsCalculated: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Computed properties
  get isRegistrationOpen(): boolean {
    const now = new Date();
    return (
      this.status === ContestStatus.REGISTRATION_OPEN &&
      now >= this.registrationOpenTime &&
      now <= this.registrationDeadline &&
      (this.maxParticipants === null || this.currentParticipants < this.maxParticipants)
    );
  }

  get isInProgress(): boolean {
    const now = new Date();
    return this.status === ContestStatus.IN_PROGRESS && now >= this.startTime && now <= this.endTime;
  }

  get hasEnded(): boolean {
    return this.status === ContestStatus.COMPLETED || new Date() > this.endTime;
  }

  get spotsRemaining(): number | null {
    if (this.maxParticipants === null) return null;
    return Math.max(0, this.maxParticipants - this.currentParticipants);
  }
}
