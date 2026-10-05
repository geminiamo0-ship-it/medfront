import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';

export enum JobPostingStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('job_postings')
@Index(['status'])
export class JobPosting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 120 })
  department: string;

  @Column({ type: 'varchar', length: 120 })
  location: string;

  @Column({ type: 'varchar', length: 60 })
  employmentType: string;

  @Column({ type: 'varchar', length: 60 })
  level: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  responsibilities?: string;

  @Column({ type: 'text', nullable: true })
  requirements?: string;

  @Column({ type: 'enum', enum: JobPostingStatus, default: JobPostingStatus.OPEN })
  status: JobPostingStatus;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany('JobApplication', 'job')
  applications: any[];
}
