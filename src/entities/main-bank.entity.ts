import { LibrarySource } from '../library/library-source.constants';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

@Entity('main_banks')
@Index(['code'], { unique: true })
export class MainBank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. "UWorld", "TheBoss", "NBME", "Mehlman"

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string; // e.g. "UWORLD", "THEBOSS", "NBME", "MEHLMAN"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  icon: string; // emoji icon

  @Column({ type: 'varchar', length: 200, nullable: true })
  gradient: string; // CSS gradient for UI

  @Column({ type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  librarySource: LibrarySource | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @OneToMany('QuestionBank', 'mainBank')
  questionBanks: any[];
}
