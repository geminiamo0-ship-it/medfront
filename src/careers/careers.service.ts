import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting, JobPostingStatus } from '../entities/job-posting.entity';
import { JobApplication, JobApplicationStatus } from '../entities/job-application.entity';
import { CreateJobPostingDto, CreateJobApplicationDto, UpdateJobPostingDto } from './dto/careers.dto';

@Injectable()
export class CareersService {
  constructor(
    @InjectRepository(JobPosting)
    private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
  ) {}

  async getOpenJobs() {
    return this.jobRepo.find({
      where: { status: JobPostingStatus.OPEN },
      order: { createdAt: 'DESC' },
    });
  }

  async getPublicJob(id: number) {
    const job = await this.jobRepo.findOne({
      where: { id, status: JobPostingStatus.OPEN },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getAdminJobs(params?: { status?: string; search?: string }) {
    const qb = this.jobRepo.createQueryBuilder('job');

    if (params?.status) {
      qb.andWhere('job.status = :status', { status: params.status });
    }

    if (params?.search) {
      qb.andWhere(
        '(job.title ILIKE :term OR job.department ILIKE :term OR job.location ILIKE :term)',
        { term: `%${params.search}%` },
      );
    }

    qb.orderBy('job.createdAt', 'DESC');
    return qb.getMany();
  }

  async createJob(dto: CreateJobPostingDto) {
    const job = this.jobRepo.create({
      ...dto,
      status: dto.status || JobPostingStatus.OPEN,
    });

    if (job.status === JobPostingStatus.OPEN && !job.publishedAt) {
      job.publishedAt = new Date();
    }
    if (job.status === JobPostingStatus.CLOSED) {
      job.closedAt = new Date();
    }

    return this.jobRepo.save(job);
  }

  async updateJob(id: number, dto: UpdateJobPostingDto) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');

    Object.assign(job, dto);

    if (dto.status === JobPostingStatus.OPEN) {
      job.closedAt = null;
      job.publishedAt = job.publishedAt || new Date();
    }
    if (dto.status === JobPostingStatus.CLOSED) {
      job.closedAt = new Date();
    }

    return this.jobRepo.save(job);
  }

  async createApplication(jobId: number, dto: CreateJobApplicationDto) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.status !== JobPostingStatus.OPEN) {
      throw new NotFoundException('Job not found');
    }

    if (!dto.resumeUrl) {
      throw new BadRequestException('Resume URL is required');
    }

    const application = this.applicationRepo.create({
      jobId: job.id,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      country: dto.country,
      currentRole: dto.currentRole,
      linkedinUrl: dto.linkedinUrl,
      portfolioUrl: dto.portfolioUrl,
      coverLetter: dto.coverLetter,
      resumeUrl: dto.resumeUrl,
      status: JobApplicationStatus.NEW,
    });

    return this.applicationRepo.save(application);
  }

  async getApplications(params?: { jobId?: number; status?: string; search?: string }) {
    const qb = this.applicationRepo.createQueryBuilder('application');
    qb.leftJoinAndSelect('application.job', 'job');

    if (params?.jobId) {
      qb.andWhere('application.jobId = :jobId', { jobId: params.jobId });
    }

    if (params?.status) {
      qb.andWhere('application.status = :status', { status: params.status });
    }

    if (params?.search) {
      qb.andWhere(
        '(application.fullName ILIKE :term OR application.email ILIKE :term OR job.title ILIKE :term)',
        { term: `%${params.search}%` },
      );
    }

    qb.orderBy('application.createdAt', 'DESC');
    return qb.getMany();
  }

  async getApplication(id: number) {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['job'],
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async updateApplicationStatus(id: number, status: JobApplicationStatus) {
    const application = await this.applicationRepo.findOne({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    application.status = status;
    return this.applicationRepo.save(application);
  }

}
