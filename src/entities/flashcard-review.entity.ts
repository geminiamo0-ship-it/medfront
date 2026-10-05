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
import { User } from './user.entity';
import { Flashcard } from './flashcard.entity';

export enum FlashcardStudyState {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEW = 'review',
  SUSPENDED = 'suspended',
}

export enum FlashcardStudyRating {
  AGAIN = 'again',
  HARD = 'hard',
  GOOD = 'good',
  EASY = 'easy',
}

@Entity('flashcard_reviews')
@Unique(['userId', 'cardId'])
@Index(['userId'])
@Index(['cardId'])
@Index(['userId', 'state'])
@Index(['userId', 'dueAt'])
@Index(['userId', 'buriedUntil'])
export class FlashcardReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  cardId: number;

  @Column({
    type: 'varchar',
    length: 16,
    default: FlashcardStudyState.NEW,
  })
  state: FlashcardStudyState;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  buriedUntil: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastReviewedAt: Date;

  @Column({ type: 'varchar', length: 16, nullable: true })
  lastRating: FlashcardStudyRating;

  @Column({ type: 'int', default: 0 })
  intervalDays: number;

  @Column({ type: 'double precision', default: 2.5 })
  easeFactor: number;

  @Column({ type: 'int', default: 0 })
  learningStep: number;

  @Column({ type: 'int', default: 0 })
  reps: number;

  @Column({ type: 'int', default: 0 })
  lapses: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Flashcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  card: Flashcard;
}
