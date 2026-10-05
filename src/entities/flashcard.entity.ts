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
import { User } from './user.entity';
import { Question } from './question.entity';
import { FlashcardDeck } from './flashcard-deck.entity';

export enum FlashcardContentType {
  TEXT = 'text',
  IMAGE = 'image',
  TABLE = 'table',
}

export interface FlashcardContentBlock {
  type: FlashcardContentType;
  value: string;
}

@Entity('flashcards')
@Index(['userId'])
@Index(['deckId'])
@Index(['questionId'])
@Index(['markColor'])
@Index(['rating'])
@Index(['userId', 'deckId'])
@Index(['userId', 'questionId'])
@Index(['color'])
export class Flashcard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  deckId: number;

  @Column({ type: 'int', nullable: true })
  questionId: number;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  frontContent: FlashcardContentBlock[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  backContent: FlashcardContentBlock[];

  @Column({ type: 'text', nullable: true })
  frontPlainText: string;

  @Column({ type: 'text', nullable: true })
  backPlainText: string;

  @Column({ type: 'boolean', default: false })
  isMarked: boolean;

  @Column({ type: 'varchar', length: 7, nullable: true })
  markColor: string;

  @Column({ type: 'int', nullable: true })
  rating: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => FlashcardDeck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck: FlashcardDeck;

  @ManyToOne(() => Question, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
