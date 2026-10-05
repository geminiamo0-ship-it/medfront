import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Contest } from './contest.entity';
import { User } from './user.entity';

export enum ParticipantStatus {
  REGISTERED = 'registered', // Signed up, waiting for contest to start
  READY = 'ready', // Contest started, can begin
  IN_PROGRESS = 'in_progress', // Currently taking the contest
  COMPLETED = 'completed', // Finished all questions
  TIMED_OUT = 'timed_out', // Ran out of time
  DISQUALIFIED = 'disqualified', // Cheating or rule violation
}

/**
 * Tracks a user's participation in a contest
 * Complete flow from registration to completion
 */
@Entity('contest_participants')
@Unique(['contestId', 'userId'])
@Index(['contestId', 'status'])
@Index(['contestId', 'totalScore', 'timeSpentSeconds']) // For leaderboard
export class ContestParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  contestId: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.REGISTERED,
  })
  status: ParticipantStatus;

  // REGISTRATION PHASE
  @Column({ type: 'timestamp' })
  registeredAt: Date;

  // CONTEST PHASE
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date; // When they clicked "Start Contest"

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date; // For detecting idle/disconnected users

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When they submitted final answer or time ran out

  // SCORING
  @Column({ type: 'int', default: 0 })
  totalScore: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  wrongAnswers: number;

  @Column({ type: 'int', default: 0 })
  unansweredQuestions: number;

  @Column({ type: 'int', default: 0 })
  timeSpentSeconds: number; // Total time (for tiebreaker)

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  accuracyPercentage: number;

  // RANKING
  @Column({ type: 'int', nullable: true })
  rank: number; // Final rank (1st, 2nd, etc.)

  @Column({ type: 'int', nullable: true })
  percentile: number; // Top X%

  @Column({ type: 'int', nullable: true })
  oldRating: number;

  @Column({ type: 'int', nullable: true })
  ratingChange: number;

  @Column({ type: 'json', nullable: true })
  answers: Record<number, number | string>;

  @Column({ type: 'json', nullable: true })
  submissionTimes: Record<number, string | Date>;

  @Column({ type: 'json', nullable: true })
  answerSequences: Record<number, number[]>;

  @Column({ type: 'json', nullable: true })
  pointsEarnedByQuestion: Record<number, number>;

  // BEHAVIORAL ANALYTICS
  @Column({ type: 'int', default: 0 })
  totalAnswerChanges: number; // Sum of all answer changes

  @Column({ type: 'int', default: 0 })
  rightToWrongChanges: number; // Specifically correct -> incorrect

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageTimePerQuestion: number;

  @Column({ type: 'int', default: 0 })
  questionsMarkedForReview: number;

  @Column({ type: 'json', nullable: true })
  performanceBySubject: {
    [subjectId: string]: {
      attempted: number;
      correct: number;
      accuracy: number;
    };
  };

  @Column({ type: 'json', nullable: true })
  behaviorSummary: {
    rushingPattern?: boolean; // Answered many questions very quickly
    hesitationPattern?: boolean; // Many answer changes
    strongStart?: boolean; // Better performance in first half
    strongFinish?: boolean; // Better performance in second half
    consistentPace?: boolean; // Even time distribution
    selfDoubtPattern?: boolean; // Changed right answer to wrong answer
  };

  // DISQUALIFICATION
  @Column({ type: 'text', nullable: true })
  disqualificationReason: string;

  @Column({ type: 'timestamp', nullable: true })
  disqualifiedAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Contest)
  @JoinColumn({ name: 'contestId' })
  contest: Contest;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Computed properties
  get isActive(): boolean {
    return this.status === ParticipantStatus.IN_PROGRESS;
  }

  get hasFinished(): boolean {
    return [
      ParticipantStatus.COMPLETED,
      ParticipantStatus.TIMED_OUT,
      ParticipantStatus.DISQUALIFIED,
    ].includes(this.status);
  }

  get timeRemaining(): number | null {
    if (!this.startedAt || this.hasFinished) return null;
    // Calculate based on contest duration
    return null; // Will be computed with contest data
  }
}
