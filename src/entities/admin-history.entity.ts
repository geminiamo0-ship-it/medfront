import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('admin_history')
export class AdminHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'adminEmail' })
  adminEmail: string;

  @Column()
  action: string;

  @Column({ name: 'targetEntity', nullable: true })
  targetEntity: string;

  @Column({ name: 'targetId', nullable: true })
  targetId: string;

  @Column({ nullable: true })
  topic: string;

  @Column({ type: 'jsonb', nullable: true, name: 'changes' })
  details: any;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
