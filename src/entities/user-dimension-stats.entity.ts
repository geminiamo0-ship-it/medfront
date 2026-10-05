import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DimensionType {
  DIFFICULTY = 'difficulty',
  SUBJECT = 'subject',
  SYSTEM = 'system',
  TOPIC = 'topic',
  QUESTION_BANK = 'question_bank',
}

@Entity('user_dimension_stats')
@Index(['userId', 'step', 'dimensionType', 'dimensionKey'], { unique: true })
@Index(['userId', 'step', 'dimensionType'])
export class UserDimensionStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  step: number;

  @Column({
    type: 'enum',
    enum: DimensionType,
  })
  dimensionType: DimensionType;

  @Column({ type: 'varchar', length: 120 })
  dimensionKey: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  dimensionName: string;

  @Column({ type: 'int', default: 0 })
  attempted: number;

  @Column({ type: 'int', default: 0 })
  correct: number;

  @Column({ type: 'int', default: 0 })
  totalTimeSeconds: number;

  @Column({ type: 'int', default: 0 })
  correctTimeSeconds: number;

  @Column({ type: 'int', default: 0 })
  incorrectTimeSeconds: number;

  @Column({ type: 'int', default: 0 })
  cToICount: number;

  @Column({ type: 'int', default: 0 })
  iToCCount: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
