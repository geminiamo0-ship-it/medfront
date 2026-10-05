import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { JobPosting } from './job-posting.entity';

export enum JobApplicationStatus {
  NEW = 'new',
  REVIEWED = 'reviewed',
  SHORTLISTED = 'shortlisted',
  REJECTED = 'rejected',
  HIRED = 'hired',
}

@Entity('job_applications')
@Index(['jobId'])
@Index(['status'])
export class JobApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  jobId: number;

  @Column({ type: 'varchar', length: 160 })
  fullName: string;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 60 })
  phone: string;

  @Column({ type: 'varchar', length: 120 })
  country: string;

  @Column({ type: 'varchar', length: 160 })
  currentRole: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedinUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  portfolioUrl?: string;

  @Column({ type: 'text', nullable: true })
  coverLetter?: string;

  @Column({ type: 'varchar', length: 500 })
  resumeUrl: string;

  @Column({ type: 'enum', enum: JobApplicationStatus, default: JobApplicationStatus.NEW })
  status: JobApplicationStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => JobPosting, (job) => job.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: JobPosting;
}
