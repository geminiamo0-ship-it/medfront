import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_analytics_stats')
@Index(['userId', 'step'], { unique: true })
export class UserAnalyticsStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  step: number;

  @Column({ type: 'int', default: 0 })
  testsCompleted: number;

  @Column({ type: 'int', default: 0 })
  questionsAttempted: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  totalTimeSeconds: number;

  @Column({ type: 'int', default: 0 })
  cToCCount: number;

  @Column({ type: 'int', default: 0 })
  cToICount: number;

  @Column({ type: 'int', default: 0 })
  iToCCount: number;

  @Column({ type: 'int', default: 0 })
  iToICount: number;

  @Column({ type: 'int', default: 0 })
  fastCorrectCount: number;

  @Column({ type: 'int', default: 0 })
  slowCorrectCount: number;

  @Column({ type: 'int', default: 0 })
  slowIncorrectCount: number;

  @Column({ type: 'int', default: 0 })
  fastIncorrectCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalConfidenceScore: number;

  @Column({ type: 'int', default: 0 })
  confidenceSamples: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalOverthinkingIndex: number;

  @Column({ type: 'int', default: 0 })
  overthinkingSamples: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
