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
import { Subject } from './subject.entity';
import { System } from './system.entity';



@Entity('topics')
@Index(['subjectId'])
@Index(['systemId'])
export class Topic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  subjectId: number;

  @Column({ type: 'int', nullable: true })
  systemId: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Subject, (subject) => subject.questions)
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @ManyToOne(() => System, (system) => system.topics, { nullable: true })
  @JoinColumn({ name: 'systemId' })
  system: System;

  @OneToMany('Question', 'topic')
  questions: any[];
}
