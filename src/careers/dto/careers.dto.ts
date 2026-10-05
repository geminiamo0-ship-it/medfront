import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { JobPostingStatus } from '../../entities/job-posting.entity';
import { JobApplicationStatus } from '../../entities/job-application.entity';

export class CreateJobPostingDto {
  @ApiProperty({ description: 'Job title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @ApiProperty({ description: 'Department' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  department: string;

  @ApiProperty({ description: 'Location' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  location: string;

  @ApiProperty({ description: 'Employment type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  employmentType: string;

  @ApiProperty({ description: 'Level' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  level: string;

  @ApiProperty({ description: 'Short summary' })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiPropertyOptional({ description: 'Full description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Responsibilities (one per line)' })
  @IsOptional()
  @IsString()
  responsibilities?: string;

  @ApiPropertyOptional({ description: 'Requirements (one per line)' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ enum: JobPostingStatus, description: 'Job status' })
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class UpdateJobPostingDto {
  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ description: 'Location' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ description: 'Employment type' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Level' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  level?: string;

  @ApiPropertyOptional({ description: 'Short summary' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Full description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Responsibilities (one per line)' })
  @IsOptional()
  @IsString()
  responsibilities?: string;

  @ApiPropertyOptional({ description: 'Requirements (one per line)' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ enum: JobPostingStatus, description: 'Job status' })
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class CreateJobApplicationDto {
  @ApiProperty({ description: 'Applicant full name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName: string;

  @ApiProperty({ description: 'Applicant email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Applicant phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  phone: string;

  @ApiProperty({ description: 'Applicant country' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  country: string;

  @ApiProperty({ description: 'Current role or school' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  currentRole: string;

  @ApiPropertyOptional({ description: 'LinkedIn URL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'Portfolio URL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  portfolioUrl?: string;

  @ApiPropertyOptional({ description: 'Cover letter' })
  @IsOptional()
  @IsString()
  coverLetter?: string;

  @ApiProperty({ description: 'Resume URL' })
  @IsUrl()
  @IsNotEmpty()
  resumeUrl: string;
}

export class UpdateJobApplicationStatusDto {
  @ApiProperty({ enum: JobApplicationStatus, description: 'Application status' })
  @IsEnum(JobApplicationStatus)
  status: JobApplicationStatus;
}
