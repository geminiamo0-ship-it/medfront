import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('flashcard_stats')
export class FlashcardStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  userId: number;

  @Column({ type: 'int', default: 0, nullable: true })
  totalCardsCreated: number;

  @Column({ type: 'int', default: 0, nullable: true })
  totalReviews: number;

  @Column({ type: 'int', default: 0, nullable: true })
  currentStreak: number;

  @Column({ type: 'int', default: 0, nullable: true })
  longestStreak: number;

  @Column({ type: 'timestamp', nullable: true })
  lastReviewDate: Date;

  @Column({ type: 'int', default: 0, nullable: true })
  cardsReviewedToday: number;

  @Column({ type: 'int', default: 0, nullable: true })
  totalStudyTimeMs: number;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
