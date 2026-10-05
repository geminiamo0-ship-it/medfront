import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AnalyticsCohortType {
  BLUEPRINT = 'blueprint',
  STEP = 'step',
}

@Entity('test_analytics_snapshots')
@Index(['testId'], { unique: true })
@Index(['userId', 'step', 'computedAt'])
export class TestAnalyticsSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  testId: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  step: number;

  @Column({ type: 'int' })
  totalQuestions: number;

  @Column({ type: 'int' })
  attemptedQuestions: number;

  @Column({ type: 'int' })
  correctQuestions: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  scorePercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  avgTimeSeconds: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  medianTimeSeconds: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  confidenceScore: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  overthinkingIndex: number;

  @Column({
    type: 'enum',
    enum: AnalyticsCohortType,
  })
  cohortType: AnalyticsCohortType;

  @Column({ type: 'int', default: 0 })
  cohortSize: number;

  @Column({ type: 'int', default: 0 })
  percentileRank: number;

  @Column({ type: 'boolean', default: false })
  lowConfidence: boolean;

  @Column({ type: 'jsonb', nullable: true })
  transitionCounts: {
    cToC: number;
    cToI: number;
    iToC: number;
    iToI: number;
    unknown: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  timeAccuracyQuadrants: {
    fastCorrectCount: number;
    slowCorrectCount: number;
    slowIncorrectCount: number;
    fastIncorrectCount: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  difficultyAnalytics: any;

  @Column({ type: 'jsonb', nullable: true })
  fatigueSegments: any;

  @Column({ type: 'jsonb', nullable: true })
  peerComparison: any;

  @Column({ type: 'jsonb', nullable: true })
  weaknessMap: any;

  @Column({ type: 'jsonb', nullable: true })
  insights: string[];

  @CreateDateColumn({ type: 'timestamp' })
  computedAt: Date;
}
